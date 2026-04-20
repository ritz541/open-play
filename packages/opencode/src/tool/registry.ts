// open-play: Roleplay tools replace coding tools
import { PlanExitTool } from "./plan"
import { Session } from "../session"
import { QuestionTool } from "./question"
import { TaskTool } from "./task"
import { InvalidTool } from "./invalid"
import { SkillTool } from "./skill"
import * as Tool from "./tool"
import { Config } from "../config"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@opencode-ai/plugin"
import z from "zod"
import { Plugin } from "../plugin"
import { Provider } from "../provider"
import { ProviderID, type ModelID } from "../provider/schema"
import { Flag } from "@/flag/flag"
import { Log } from "@/util"
import * as Truncate from "./truncate"
import { Glob } from "@opencode-ai/shared/util/glob"
import path from "path"
import { pathToFileURL } from "url"
import { Effect, Layer, Context } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import * as CrossSpawnSpawner from "@/effect/cross-spawn-spawner"
import { Format } from "../format"
import { InstanceState } from "@/effect"
import { Question } from "../question"
import { Agent } from "../agent/agent"
import { Skill } from "../skill"
import { Permission } from "@/permission"
// Roleplay tools
import { CharacterTool } from "./character"
import { LoreTool } from "./lore"
import { SceneTool } from "./scene"
import { TtsTool } from "./tts"
import { createReadTool } from "./internal-reader"

const log = Log.create({ service: "tool.registry" })

type TaskDef = Tool.InferDef<typeof TaskTool>
type CharacterDef = Tool.InferDef<typeof CharacterTool>
import type { Def } from "./tool"

type State = {
  custom: Tool.Def[]
  builtin: Tool.Def[]
  task: TaskDef
  character: CharacterDef
  read: Def
}

export interface Interface {
  readonly ids: () => Effect.Effect<string[]>
  readonly all: () => Effect.Effect<Tool.Def[]>
  readonly named: () => Effect.Effect<{ task: TaskDef; character: CharacterDef; read: Def }>
  readonly tools: (model: { providerID: ProviderID; modelID: ModelID; agent: Agent.Info }) => Effect.Effect<Tool.Def[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ToolRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const plugin = yield* Plugin.Service
    const agents = yield* Agent.Service
    const skill = yield* Skill.Service
    const truncate = yield* Truncate.Service

    const invalid = yield* InvalidTool
    const task = yield* TaskTool
    const question = yield* QuestionTool
    const plan = yield* PlanExitTool
    const skilltool = yield* SkillTool
    const agent = yield* Agent.Service
    // Roleplay tools
    const character = yield* CharacterTool
    const lore = yield* LoreTool
    const scene = yield* SceneTool
    const tts = yield* TtsTool

    const state = yield* InstanceState.make<State>(
      Effect.fn("ToolRegistry.state")(function* (ctx) {
        const custom: Tool.Def[] = []

        function fromPlugin(id: string, def: ToolDefinition): Tool.Def {
          return {
            id,
            parameters: z.object(def.args),
            description: def.description,
            execute: (args, toolCtx) =>
              Effect.gen(function* () {
                const pluginCtx: PluginToolContext = {
                  ...toolCtx,
                  ask: (req) => toolCtx.ask(req),
                  directory: ctx.directory,
                  worktree: ctx.worktree,
                }
                const result = yield* Effect.promise(() => def.execute(args as any, pluginCtx))
                const output = typeof result === "string" ? result : result.output
                const metadata = typeof result === "string" ? {} : (result.metadata ?? {})
                const info = yield* agent.get(toolCtx.agent)
                const out = yield* truncate.output(output, {}, info)
                return {
                  title: "",
                  output: out.truncated ? out.content : output,
                  metadata: {
                    ...metadata,
                    truncated: out.truncated,
                    ...(out.truncated && { outputPath: out.outputPath }),
                  },
                }
              }),
          }
        }

        const dirs = yield* config.directories()
        const matches = dirs.flatMap((dir) =>
          Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
        )
        if (matches.length) yield* config.waitForDependencies()
        for (const match of matches) {
          const namespace = path.basename(match, path.extname(match))
          const mod = yield* Effect.promise(
            () => import(process.platform === "win32" ? match : pathToFileURL(match).href),
          )
          for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
            custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
          }
        }

        const plugins = yield* plugin.list()
        for (const p of plugins) {
          for (const [id, def] of Object.entries(p.tool ?? {})) {
            custom.push(fromPlugin(id, def))
          }
        }

        yield* config.get()
        const questionEnabled =
          ["app", "cli", "desktop"].includes(Flag.OPENCODE_CLIENT) || Flag.OPENCODE_ENABLE_QUESTION_TOOL

        const tool = yield* Effect.all({
          invalid: Tool.init(invalid),
          task: Tool.init(task),
          skill: Tool.init(skilltool),
          question: Tool.init(question),
          plan: Tool.init(plan),
          // Roleplay tools
          character: Tool.init(character),
          lore: Tool.init(lore),
          scene: Tool.init(scene),
          tts: Tool.init(tts),
        })

        return {
          custom,
          builtin: [
            tool.invalid,
            ...(questionEnabled ? [tool.question] : []),
            tool.task,
            tool.skill,
            // Roleplay tools
            tool.character,
            tool.lore,
            tool.scene,
            tool.tts,
            ...(Flag.OPENCODE_EXPERIMENTAL_PLAN_MODE && Flag.OPENCODE_CLIENT === "cli" ? [tool.plan] : []),
          ],
          task: tool.task,
          character: tool.character,
          read: createReadTool(),
        }
      }),
    )

    const all: Interface["all"] = Effect.fn("ToolRegistry.all")(function* () {
      const s = yield* InstanceState.get(state)
      return [...s.builtin, ...s.custom] as Tool.Def[]
    })

    const ids: Interface["ids"] = Effect.fn("ToolRegistry.ids")(function* () {
      return (yield* all()).map((tool) => tool.id)
    })

    const describeSkill = Effect.fn("ToolRegistry.describeSkill")(function* (agent: Agent.Info) {
      const list = yield* skill.available(agent)
      if (list.length === 0) return "No skills are currently available."
      return [
        "Load a specialized skill that provides domain-specific instructions and workflows.",
        "",
        "When you recognize that a task matches one of the available skills listed below, use this tool to load the full skill instructions.",
        "",
        "The skill will inject detailed instructions, workflows, and access to bundled resources (scripts, references, templates) into the conversation context.",
        "",
        'Tool output includes a `<skill_content name="...">` block with the loaded content.',
        "",
        "The following skills provide specialized sets of instructions for particular tasks",
        "Invoke this tool to load a skill when a task matches one of the available skills listed below:",
        "",
        Skill.fmt(list, { verbose: false }),
      ].join("\n")
    })

    const describeTask = Effect.fn("ToolRegistry.describeTask")(function* (agent: Agent.Info) {
      const items = (yield* agents.list()).filter((item) => item.mode !== "primary")
      const filtered = items.filter(
        (item) => Permission.evaluate("task", item.name, agent.permission).action !== "deny",
      )
      const list = filtered.toSorted((a, b) => a.name.localeCompare(b.name))
      const description = list
        .map(
          (item) =>
            `- ${item.name}: ${item.description ?? "This subagent should only be called manually by the user."}`,
        )
        .join("\n")
      return ["Available agent types and the tools they have access to:", description].join("\n")
    })

    const tools: Interface["tools"] = Effect.fn("ToolRegistry.tools")(function* (input) {
      const filtered = yield* all()

      return yield* Effect.forEach(
        filtered,
        Effect.fnUntraced(function* (tool: Tool.Def) {
          using _ = log.time(tool.id)
          const output = {
            description: tool.description,
            parameters: tool.parameters,
          }
          yield* plugin.trigger("tool.definition", { toolID: tool.id }, output)
          return {
            id: tool.id,
            description: [
              output.description,
              tool.id === TaskTool.id ? yield* describeTask(input.agent) : undefined,
              tool.id === SkillTool.id ? yield* describeSkill(input.agent) : undefined,
            ]
              .filter(Boolean)
              .join("\n"),
            parameters: output.parameters,
            execute: tool.execute,
            formatValidationError: tool.formatValidationError,
          }
        }),
        { concurrency: "unbounded" },
      )
    })

    const named: Interface["named"] = Effect.fn("ToolRegistry.named")(function* () {
      const s = yield* InstanceState.get(state)
      return { task: s.task, character: s.character, read: s.read }
    })

    return Service.of({ ids, all, named, tools })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Config.defaultLayer),
    Layer.provide(Plugin.defaultLayer),
    Layer.provide(Question.defaultLayer),
    Layer.provide(Skill.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(Session.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Format.defaultLayer),
    Layer.provide(CrossSpawnSpawner.defaultLayer),
    Layer.provide(Truncate.defaultLayer),
  ),
)
