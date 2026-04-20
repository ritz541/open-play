import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool"
import { SceneStore, CharacterStore, generateId } from "../roleplay/storage"
import type { Scene, SceneMessage } from "../roleplay/storage"

const createParams = z.object({
  action: z.literal("create"),
  title: z.string().describe("Scene title - where/when is this happening"),
  setting: z.string().describe("Detailed description of the environment and atmosphere"),
  participants: z.array(z.string()).describe("Character IDs that are present in this scene"),
  narrator: z.string().describe("Character ID who narrates, or 'narrator' for default").default("narrator"),
})

const listParams = z.object({
  action: z.literal("list"),
})

const getParams = z.object({
  action: z.literal("get"),
  id: z.string().describe("Scene ID"),
})

const narrateParams = z.object({
  action: z.literal("narrate"),
  id: z.string().describe("Scene ID"),
  content: z.string().describe("Narration text - describe what happens, environment details"),
})

const speakParams = z.object({
  action: z.literal("speak"),
  id: z.string().describe("Scene ID"),
  character_id: z.string().describe("Which character is speaking"),
  content: z.string().describe("Dialogue and actions for this character"),
})

const playerParams = z.object({
  action: z.literal("player"),
  id: z.string().describe("Scene ID"),
  content: z.string().describe("What the player says or does"),
})

const switchParams = z.object({
  action: z.literal("switch_narrator"),
  id: z.string().describe("Scene ID"),
  narrator: z.string().describe("New narrator character ID, or 'narrator'"),
})

const deleteParams = z.object({
  action: z.literal("delete"),
  id: z.string().describe("Scene ID to delete"),
})

const parameters = z.discriminatedUnion("action", [
  createParams,
  listParams,
  getParams,
  narrateParams,
  speakParams,
  playerParams,
  switchParams,
  deleteParams,
])

export const SceneTool = Tool.define(
  "scene",
  Effect.gen(function* () {
    return {
      description: [
        "Manage roleplay scenes - the active storytelling sessions.",
        "Create scenes with a setting and participants, then narrate, speak as characters, or input player actions.",
        "Scenes track full conversation history for context.",
        "Use 'narrate' for environment/NPC descriptions, 'speak' for character dialogue, 'player' for user actions.",
      ].join("\n"),
      parameters,
      execute: (args, ctx) =>
        Effect.gen(function* () {
          switch (args.action) {
            case "create": {
              // Validate that all participants exist
              for (const charId of args.participants) {
                if (charId !== "narrator") {
                  yield* CharacterStore.get(charId)
                }
              }
              const scene: Scene = {
                id: generateId(),
                title: args.title,
                setting: args.setting,
                participants: args.participants,
                current_narrator: args.narrator,
                history: [
                  {
                    role: "narrator",
                    content: args.setting,
                    timestamp: new Date().toISOString(),
                  },
                ],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              yield* SceneStore.save(scene)
              const charNames = yield* Effect.forEach(args.participants, (id) =>
                id === "narrator"
                  ? Effect.succeed("Narrator")
                  : CharacterStore.get(id).pipe(Effect.map((c) => c.name))
              )
              return {
                title: `Scene started: ${scene.title}`,
                metadata: { scene_id: scene.id },
                output: [
                  `**${scene.title}**`,
                  ``,
                  `Setting: ${scene.setting}`,
                  `Participants: ${charNames.join(", ")}`,
                  `Narrator: ${args.narrator === "narrator" ? "Default" : charNames.find((_, i) => args.participants[i] === args.narrator)}`,
                  ``,
                  `Scene ID: ${scene.id}`,
                  `The scene is set. Let the story begin!`,
                ].join("\n"),
              }
            }

            case "list": {
              const scenes = yield* SceneStore.list
              if (scenes.length === 0) {
                return {
                  title: "No scenes",
                  metadata: {},
                  output: "No active scenes. Create one to start roleplaying!",
                }
              }
              const list = scenes
                .map((s) => `- **${s.title}** [${s.id}] - ${s.history.length} messages, ${s.participants.length} participants`)
                .join("\n")
              return {
                title: `${scenes.length} scene(s)`,
                metadata: {},
                output: list,
              }
            }

            case "get": {
              const scene = yield* SceneStore.get(args.id)
              const charNames = yield* Effect.forEach(scene.participants, (id) =>
                id === "narrator"
                  ? Effect.succeed("Narrator")
                  : CharacterStore.get(id).pipe(Effect.map((c) => c.name))
              )
              const recentHistory = scene.history.slice(-10)
              const historyStr = recentHistory
                .map((m) => {
                  if (m.role === "narrator") return `[Narrator]: ${m.content}`
                  if (m.role === "player") return `[Player]: ${m.content}`
                  return `[${charNames[scene.participants.indexOf(m.character_id!)] ?? "Unknown"}]: ${m.content}`
                })
                .join("\n\n")
              return {
                title: `Scene: ${scene.title}`,
                metadata: { scene },
                output: [
                  `**${scene.title}** [${scene.id}]`,
                  `Setting: ${scene.setting}`,
                  `Participants: ${charNames.join(", ")}`,
                  `Messages: ${scene.history.length}`,
                  ``,
                  `**Recent history:**`,
                  historyStr || "(empty)",
                ].join("\n"),
              }
            }

            case "narrate": {
              const msg: SceneMessage = {
                role: "narrator",
                content: args.content,
                timestamp: new Date().toISOString(),
              }
              yield* SceneStore.addMessage(args.id, msg)
              return {
                title: "Narration added",
                metadata: {},
                output: `*[Narrator]: ${args.content}*`,
              }
            }

            case "speak": {
              const char = yield* CharacterStore.get(args.character_id)
              const msg: SceneMessage = {
                role: "character",
                character_id: args.character_id,
                content: args.content,
                timestamp: new Date().toISOString(),
              }
              yield* SceneStore.addMessage(args.id, msg)
              return {
                title: `${char.name} speaks`,
                metadata: { character: char },
                output: `**${char.name}:** ${args.content}`,
              }
            }

            case "player": {
              const msg: SceneMessage = {
                role: "player",
                content: args.content,
                timestamp: new Date().toISOString(),
              }
              yield* SceneStore.addMessage(args.id, msg)
              return {
                title: "Player action",
                metadata: {},
                output: `*[You]: ${args.content}*`,
              }
            }

            case "switch_narrator": {
              const scene = yield* SceneStore.get(args.id)
              scene.current_narrator = args.narrator
              yield* SceneStore.save(scene)
              const name = args.narrator === "narrator"
                ? "Default Narrator"
                : (yield* CharacterStore.get(args.narrator)).name
              return {
                title: `Narrator switched to ${name}`,
                metadata: {},
                output: `The narrator for this scene is now **${name}**.`,
              }
            }

            case "delete": {
              const scene = yield* SceneStore.get(args.id)
              yield* SceneStore.delete(args.id)
              return {
                title: `Deleted scene: ${scene.title}`,
                metadata: {},
                output: `Scene **${scene.title}** has been deleted.`,
              }
            }
          }
        }),
    }
  }),
)
