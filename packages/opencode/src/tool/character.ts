import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { CharacterStore, generateId } from "../roleplay/storage"
import type { Character } from "../roleplay/storage"

export const CharacterTool = (Tool.define as any)(
  "character",
  Effect.gen(function* () {
    return {
      description: [
      "Manage characters in the roleplay world.",
      "Create, list, view, update, or delete characters.",
      "Each character has a name, persona, personality, speaking style, and background.",
      "Characters can be used as NPCs (controlled by the AI) or as the player character.",
    ].join("\n"),

    parameters: z.object({
      action: z.enum(["create", "list", "get", "update", "delete"]).describe("Action to perform"),
      id: z.string().describe("Character ID (required for get, update, delete)").optional(),
      name: z.string().describe("Character name").optional(),
      persona: z.string().describe("Who they are - role, race, class, appearance").optional(),
      personality: z.string().describe("Personality traits, quirks, motivations").optional(),
      speaking_style: z.string().describe("How they talk - accent, vocabulary, speech patterns").optional(),
      background: z.string().describe("Backstory and history").optional(),
      voice_id: z.string().describe("TTS voice ID for this character").optional(),
    }),

    execute: (args: any, ctx: any) =>
      Effect.gen(function* () {
        const action = args.action as string

        if (action === "create") {
          const char: Character = {
            id: generateId(),
            name: args.name ?? "Unnamed",
            persona: args.persona ?? "",
            personality: args.personality ?? "",
            speaking_style: args.speaking_style ?? "",
            background: args.background ?? "",
            voice_id: args.voice_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          yield* CharacterStore.save(char)
          return {
            title: `Created: ${char.name}`,
            metadata: { character_id: char.id },
            output: `**${char.name}** created! ID: ${char.id}\nPersona: ${char.persona}\nPersonality: ${char.personality}\nSpeaking Style: ${char.speaking_style}`,
          }
        }

        if (action === "list") {
          const characters = yield* CharacterStore.list
          if (characters.length === 0) {
            return { title: "No characters", metadata: {}, output: "No characters yet. Create one!" }
          }
          const list = characters.map((c: Character) => `- **${c.name}** [${c.id}]: ${c.persona}`).join("\n")
          return { title: `${characters.length} character(s)`, metadata: {}, output: list }
        }

        if (action === "get") {
          const char = yield* CharacterStore.get(args.id)
          return {
            title: `Character: ${char.name}`,
            metadata: { character: char },
            output: `**${char.name}** [${char.id}]\n\n**Persona:** ${char.persona}\n**Personality:** ${char.personality}\n**Speaking Style:** ${char.speaking_style}\n**Background:** ${char.background}`,
          }
        }

        if (action === "update") {
          const char = yield* CharacterStore.get(args.id)
          if (args.name) char.name = args.name
          if (args.persona) char.persona = args.persona
          if (args.personality) char.personality = args.personality
          if (args.speaking_style) char.speaking_style = args.speaking_style
          if (args.background) char.background = args.background
          if (args.voice_id !== undefined) char.voice_id = args.voice_id
          yield* CharacterStore.save(char)
          return { title: `Updated: ${char.name}`, metadata: {}, output: `Character **${char.name}** updated!` }
        }

        if (action === "delete") {
          const char = yield* CharacterStore.get(args.id)
          yield* CharacterStore.delete(args.id)
          return { title: `Deleted: ${char.name}`, metadata: {}, output: `Character **${char.name}** deleted.` }
        }

        return { title: "Unknown action", metadata: {}, output: "Unknown action: " + action }
      }),
    }
  }),
)
