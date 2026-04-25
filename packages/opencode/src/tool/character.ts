import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { CharacterStore, ActiveStateStore, generateId } from "../roleplay/storage"
import type { Character } from "../roleplay/storage"

const Parameters = z.object({
  action: z.enum(["create", "list", "get", "update", "delete", "set_player"]).describe("Action to perform"),
  id: z.string().describe("Character ID (required for get, update, delete)").optional(),
  name: z.string().describe("Character name").optional(),
  persona: z.string().describe("Who they are - role, race, class, appearance").optional(),
  personality: z.string().describe("Personality traits, quirks, motivations").optional(),
  speaking_style: z.string().describe("How they talk - accent, vocabulary, speech patterns").optional(),
  background: z.string().describe("Backstory and history").optional(),
  voice_id: z.string().describe("TTS voice ID for this character").optional(),
})

export const CharacterTool = Tool.define(
  "character",
  Effect.gen(function* () {
    const meta = (id?: string) => ({ id })

    return {
      description: [
        "Manage characters in the roleplay world.",
        "Create, list, view, update, or delete characters.",
        "Each character has a name, persona, personality, speaking style, and background.",
        "Use `set_player` to mark a character as the player's avatar.",
      ].join("\n"),

      parameters: Parameters,

      execute: (args: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const action = args.action
          const id = args.id

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
              metadata: meta(char.id),
              output: [
                `**${char.name}** created! ID: ${char.id}`,
                `Persona: ${char.persona}`,
                `Personality: ${char.personality}`,
                `Speaking Style: ${char.speaking_style}`,
              ].join("\n"),
            }
          }

          if (action === "list") {
            const characters = yield* CharacterStore.list
            if (characters.length === 0) {
              return { title: "No characters", metadata: meta(), output: "No characters yet. Create one!" }
            }
            const list = characters.map((c: Character) => `- **${c.name}** [${c.id}]: ${c.persona}`).join("\n")
            return { title: `${characters.length} character(s)`, metadata: meta(), output: list }
          }

          if (action === "get") {
            const char = yield* CharacterStore.get(id!)
            return {
              title: `Character: ${char.name}`,
              metadata: meta(char.id),
              output: [
                `**${char.name}** [${char.id}]`,
                "",
                `**Persona:** ${char.persona}`,
                `**Personality:** ${char.personality}`,
                `**Speaking Style:** ${char.speaking_style}`,
                `**Background:** ${char.background}`,
              ].join("\n"),
            }
          }

          if (action === "update") {
            const char = yield* CharacterStore.get(id!)
            if (args.name) char.name = args.name
            if (args.persona) char.persona = args.persona
            if (args.personality) char.personality = args.personality
            if (args.speaking_style) char.speaking_style = args.speaking_style
            if (args.background) char.background = args.background
            if (args.voice_id !== undefined) char.voice_id = args.voice_id
            yield* CharacterStore.save(char)
            return { title: `Updated: ${char.name}`, metadata: meta(char.id), output: `Character **${char.name}** updated!` }
          }

          if (action === "set_player") {
            const char = yield* CharacterStore.get(id!)
            yield* ActiveStateStore.setPlayerCharacter(id!)
            return {
              title: `Player: ${char.name}`,
              metadata: meta(char.id),
              output: `**${char.name}** is now the player character.`,
            }
          }

          if (action === "delete") {
            const char = yield* CharacterStore.get(id!)
            yield* CharacterStore.delete(id!)
            return { title: `Deleted: ${char.name}`, metadata: meta(char.id), output: `Character **${char.name}** deleted.` }
          }

          return { title: "Unknown action", metadata: meta(), output: `Unknown action: ${action}` }
        }).pipe(Effect.orDie),
    }
  }),
)
