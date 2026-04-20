import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { CharacterStore } from "../roleplay/storage"

const ORPHEUS_VOICES = [
  { name: "tara", style: "warm, friendly" },
  { name: "leah", style: "soft, gentle" },
  { name: "jess", style: "energetic, playful" },
  { name: "leo", style: "deep, authoritative" },
  { name: "dan", style: "casual, laid-back" },
  { name: "mia", style: "cheerful, bubbly" },
  { name: "zac", style: "serious, professional" },
  { name: "zoe", style: "mysterious, calm" },
]

export const TtsTool = (Tool.define as any)(
  "tts",
  Effect.gen(function* () {
    return {
      description: [
      "Text-to-speech for roleplay characters.",
      "Convert text to voice audio using Orpheus TTS via Groq.",
      "Supports emotion tags like [cheerful], [giggles], [sighs], [laughs].",
    ].join("\n"),

    parameters: z.object({
      action: z.enum(["speak", "list_voices"]).describe("Action to perform"),
      text: z.string().describe("Text to convert to speech").optional(),
      character_id: z.string().describe("Character ID for voice settings").optional(),
      voice: z.string().describe("Voice name override").optional(),
    }),

    execute: (args: any, ctx: any) =>
      Effect.gen(function* () {
        const action = args.action as string

        if (action === "speak") {
          let voiceName = args.voice
          if (args.character_id && !voiceName) {
            const char = yield* CharacterStore.get(args.character_id)
            voiceName = char.voice_id ?? undefined
          }
          voiceName = voiceName ?? "tara"
          return {
            title: `TTS: ${voiceName}`,
            metadata: { voice: voiceName, text: args.text, tts_pending: true },
            output: `**TTS Request** Voice: ${voiceName}\nText: "${args.text}"`,
          }
        }

        if (action === "list_voices") {
          const voices = ORPHEUS_VOICES.map((v) => `- **${v.name}**: ${v.style}`).join("\n")
          return {
            title: "Available voices",
            metadata: {},
            output: `**Orpheus TTS Voices:**\n${voices}\n\nUse emotion tags: [cheerful], [giggles], [sighs], [laughs]`,
          }
        }

        return { title: "Unknown", metadata: {}, output: "Unknown: " + action }
      }),
    }
  }),
)
