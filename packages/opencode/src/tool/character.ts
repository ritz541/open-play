import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool"
import { CharacterStore, generateId } from "../roleplay/storage"
import type { Character } from "../roleplay/storage"

const createParams = z.object({
  action: z.literal("create"),
  name: z.string().describe("Character's name"),
  persona: z.string().describe("Who they are - role, race, class, appearance"),
  personality: z.string().describe("Personality traits, quirks, motivations"),
  speaking_style: z.string().describe("How they talk - accent, vocabulary, speech patterns"),
  background: z.string().describe("Backstory and history"),
  voice_id: z.string().describe("TTS voice ID for this character (optional)").optional(),
})

const listParams = z.object({
  action: z.literal("list"),
})

const getParams = z.object({
  action: z.literal("get"),
  id: z.string().describe("Character ID"),
})

const updateParams = z.object({
  action: z.literal("update"),
  id: z.string().describe("Character ID to update"),
  name: z.string().describe("Updated name").optional(),
  persona: z.string().describe("Updated persona").optional(),
  personality: z.string().describe("Updated personality").optional(),
  speaking_style: z.string().describe("Updated speaking style").optional(),
  background: z.string().describe("Updated background").optional(),
  voice_id: z.string().describe("Updated voice ID").optional(),
})

const deleteParams = z.object({
  action: z.literal("delete"),
  id: z.string().describe("Character ID to delete"),
})

const parameters = z.discriminatedUnion("action", [
  createParams,
  listParams,
  getParams,
  updateParams,
  deleteParams,
])

export const CharacterTool = Tool.define(
  "character",
  Effect.gen(function* () {
    return {
      description: [
        "Manage characters in the roleplay world.",
        "Create, list, view, update, or delete characters.",
        "Each character has a name, persona, personality, speaking style, and background.",
        "Characters can be used as NPCs (controlled by the AI) or as the player character.",
      ].join("\n"),
      parameters,
      execute: (args, ctx) =>
        Effect.gen(function* () {
          switch (args.action) {
            case "create": {
              const char: Character = {
                id: generateId(),
                name: args.name,
                persona: args.persona,
                personality: args.personality,
                speaking_style: args.speaking_style,
                background: args.background,
                voice_id: args.voice_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              yield* CharacterStore.save(char)
              return {
                title: `Created character: ${char.name}`,
                metadata: { character_id: char.id },
                output: [
                  `**${char.name}** created successfully!`,
                  ``,
                  `ID: ${char.id}`,
                  `Persona: ${char.persona}`,
                  `Personality: ${char.personality}`,
                  `Speaking Style: ${char.speaking_style}`,
                  ``,
                  `This character is now available for scenes and roleplay.`,
                ].join("\n"),
              }
            }

            case "list": {
              const characters = yield* CharacterStore.list
              if (characters.length === 0) {
                return {
                  title: "No characters found",
                  metadata: {},
                  output: "No characters created yet. Use `character` with action='create' to make one!",
                }
              }
              const list = characters
                .map((c) => `- **${c.name}** [${c.id}]: ${c.persona}`)
                .join("\n")
              return {
                title: `${characters.length} character(s)`,
                metadata: {},
                output: list,
              }
            }

            case "get": {
              const char = yield* CharacterStore.get(args.id)
              return {
                title: `Character: ${char.name}`,
                metadata: { character: char },
                output: [
                  `**${char.name}** [${char.id}]`,
                  ``,
                  `**Persona:** ${char.persona}`,
                  `**Personality:** ${char.personality}`,
                  `**Speaking Style:** ${char.speaking_style}`,
                  `**Background:** ${char.background}`,
                  char.voice_id ? `**Voice:** ${char.voice_id}` : "",
                  ``,
                  `Created: ${char.created_at}`,
                  `Updated: ${char.updated_at}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              }
            }

            case "update": {
              const char = yield* CharacterStore.get(args.id)
              if (args.name) char.name = args.name
              if (args.persona) char.persona = args.persona
              if (args.personality) char.personality = args.personality
              if (args.speaking_style) char.speaking_style = args.speaking_style
              if (args.background) char.background = args.background
              if (args.voice_id !== undefined) char.voice_id = args.voice_id
              yield* CharacterStore.save(char)
              return {
                title: `Updated character: ${char.name}`,
                metadata: { character: char },
                output: `Character **${char.name}** updated successfully!`,
              }
            }

            case "delete": {
              const char = yield* CharacterStore.get(args.id)
              yield* CharacterStore.delete(args.id)
              return {
                title: `Deleted character: ${char.name}`,
                metadata: {},
                output: `Character **${char.name}** has been deleted.`,
              }
            }
          }
        }),
    }
  }),
)
