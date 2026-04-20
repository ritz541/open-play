import { Context, Effect, Layer } from "effect"

import { Instance } from "../project/instance"

import PROMPT_ROLEPLAY from "./prompt/default.txt"
import type { Provider } from "@/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"

// open-play: Always use the roleplay system prompt regardless of model
export function provider(model: Provider.Model) {
  return [PROMPT_ROLEPLAY]
}

export interface Interface {
  readonly environment: (model: Provider.Model) => string[]
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SystemPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service

    return Service.of({
      environment(model) {
        return [
          [
            `You are powered by ${model.api.id} (${model.providerID}/${model.api.id}).`,
            `Today is ${new Date().toDateString()}.`,
            `Character and lore data is stored in ~/.open-play/`,
            ``,
            `Use the character tool to manage characters.`,
            `Use the lore tool to manage world-building entries.`,
            `Use the scene tool to manage active storytelling.`,
          ].join("\n"),
        ]
      },

      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          Skill.fmt(list, { verbose: true }),
        ].join("\n")
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Skill.defaultLayer))

export * as SystemPrompt from "./system"
