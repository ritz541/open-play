import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { SceneStore, CharacterStore, generateId } from "../roleplay/storage"
import type { Scene, SceneMessage } from "../roleplay/storage"

export const SceneTool = (Tool.define as any)(
  "scene",
  Effect.gen(function* () {
    return {
      description: [
      "Manage roleplay scenes - the active storytelling sessions.",
      "Create scenes with a setting and participants, then narrate, speak as characters, or input player actions.",
      "Scenes track full conversation history for context.",
    ].join("\n"),

    parameters: z.object({
      action: z.enum(["create", "list", "get", "narrate", "speak", "player", "delete"]).describe("Action to perform"),
      id: z.string().describe("Scene ID").optional(),
      title: z.string().describe("Scene title").optional(),
      setting: z.string().describe("Detailed description of the environment").optional(),
      participants: z.array(z.string()).describe("Character IDs present in this scene").optional(),
      narrator: z.string().describe("Narrator character ID, or 'narrator'").optional(),
      character_id: z.string().describe("Character speaking (for speak action)").optional(),
      content: z.string().describe("Narration, dialogue, or player action text").optional(),
    }),

    execute: (args: any, ctx: any) =>
      Effect.gen(function* () {
        const action = args.action as string

        if (action === "create") {
          const participants = args.participants ?? []
          const scene: Scene = {
            id: generateId(),
            title: args.title ?? "Untitled Scene",
            setting: args.setting ?? "",
            participants,
            current_narrator: args.narrator ?? "narrator",
            history: [{ role: "narrator", content: args.setting ?? "", timestamp: new Date().toISOString() }],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          yield* SceneStore.save(scene)
          return {
            title: `Scene: ${scene.title}`,
            metadata: { scene_id: scene.id },
            output: `**${scene.title}** started!\nSetting: ${scene.setting}\nScene ID: ${scene.id}`,
          }
        }

        if (action === "list") {
          const scenes = yield* SceneStore.list
          if (scenes.length === 0) return { title: "No scenes", metadata: {}, output: "No active scenes." }
          const list = scenes.map((s: Scene) => "- **" + s.title + "** [" + s.id + "] - " + s.history.length + " msgs").join("\n")
          return { title: scenes.length + " scene(s)", metadata: {}, output: list }
        }

        if (action === "get") {
          const scene = yield* SceneStore.get(args.id)
          const historyStr = scene.history.slice(-10).map((m: SceneMessage) => {
            if (m.role === "narrator") return "[Narrator]: " + m.content
            if (m.role === "player") return "[Player]: " + m.content
            return "[Character " + (m.character_id ?? "?") + "]: " + m.content
          }).join("\n\n")
          return {
            title: "Scene: " + scene.title,
            metadata: { scene: scene },
            output: "**" + scene.title + "** [" + scene.id + "]\nSetting: " + scene.setting + "\nMessages: " + scene.history.length + "\n\n" + historyStr,
          }
        }

        if (action === "narrate") {
          yield* SceneStore.addMessage(args.id, { role: "narrator" as const, content: args.content ?? "", timestamp: new Date().toISOString() })
          return { title: "Narration added", metadata: {}, output: `*[Narrator]: ${args.content}*` }
        }

        if (action === "speak") {
          const char = yield* CharacterStore.get(args.character_id)
          yield* SceneStore.addMessage(args.id, { role: "character" as const, character_id: args.character_id, content: args.content ?? "", timestamp: new Date().toISOString() })
          return { title: `${char.name} speaks`, metadata: {}, output: `**${char.name}:** ${args.content}` }
        }

        if (action === "player") {
          yield* SceneStore.addMessage(args.id, { role: "player" as const, content: args.content ?? "", timestamp: new Date().toISOString() })
          return { title: "Player action", metadata: {}, output: `*[You]: ${args.content}*` }
        }

        if (action === "delete") {
          const scene = yield* SceneStore.get(args.id)
          yield* SceneStore.delete(args.id)
          return { title: `Deleted: ${scene.title}`, metadata: {}, output: `Scene deleted.` }
        }

        return { title: "Unknown", metadata: {}, output: "Unknown: " + action }
      }),
    }
  }),
)
