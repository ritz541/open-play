import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool"
import { CharacterStore } from "../roleplay/storage"

const speakParams = z.object({
  action: z.literal("speak"),
  text: z.string().describe("Text to convert to speech"),
  character_id: z.string().describe("Character ID to use voice settings from (optional)").optional(),
  voice: z.string().describe("Voice name override (e.g. 'hannah', 'jessie')").optional(),
})

const listVoicesParams = z.object({
  action: z.literal("list_voices"),
})

const parameters = z.discriminatedUnion("action", [speakParams, listVoicesParams])

// Available Orpheus voices
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

export const TtsTool = Tool.define(
  "tts",
  Effect.gen(function* () {
    return {
      description: [
        "Text-to-speech for roleplay characters.",
        "Convert text to voice audio using Orpheus TTS via Groq.",
        "Characters can have assigned voices, or override with a specific voice.",
        "Supports emotion tags like [cheerful], [giggles], [sighs], [laughs].",
      ].join("\n"),
      parameters,
      execute: (args, ctx) =>
        Effect.gen(function* () {
          switch (args.action) {
            case "speak": {
              let voiceName = args.voice
              if (args.character_id && !voiceName) {
                const char = yield* CharacterStore.get(args.character_id)
                voiceName = char.voice_id ?? undefined
              }
              voiceName = voiceName ?? "tara"

              // Build SSML-like text with emotion tags for Orpheus
              const ssmlText = args.text
                .replace(/\[([^\]]+)\]/g, "<|$1|>")

              return {
                title: `TTS: ${voiceName}`,
                metadata: {
                  voice: voiceName,
                  text: ssmlText,
                  character_id: args.character_id,
                  tts_pending: true, // Signal to the CLI to actually call the API
                },
                output: [
                  `**TTS Request**`,
                  `Voice: ${voiceName}`,
                  `Text: "${args.text}"`,
                  ``,
                  `Audio generation requested. The CLI will process this via Groq Orpheus TTS.`,
                ].join("\n"),
              }
            }

            case "list_voices": {
              const voices = ORPHEUS_VOICES
                .map((v) => `- **${v.name}**: ${v.style}`)
                .join("\n")
              return {
                title: "Available voices",
                metadata: {},
                output: [
                  `**Orpheus TTS Voices (via Groq):**`,
                  ``,
                  voices,
                  ``,
                  `Use emotion tags in text: [cheerful], [giggles], [sighs], [laughs], [crying]`,
                ].join("\n"),
              }
            }
          }
        }),
    }
  }),
)
