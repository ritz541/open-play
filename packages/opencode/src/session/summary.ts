import z from "zod"
import { Effect, Layer, Context } from "effect"
import { Bus } from "@/bus"
import { Snapshot } from "@/snapshot"
import * as Session from "./session"
import { MessageV2 } from "./message-v2"
import { SessionID, MessageID } from "./schema"

export interface Interface {
  readonly summarize: (input: { sessionID: SessionID; messageID: MessageID }) => Effect.Effect<void>
  readonly diff: (input: { sessionID: SessionID; messageID?: MessageID }) => Effect.Effect<Snapshot.FileDiff[]>
  readonly computeDiff: (input: { messages: MessageV2.WithParts[] }) => Effect.Effect<Snapshot.FileDiff[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionSummary") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const bus = yield* Bus.Service

    const summarize = Effect.fn("SessionSummary.summarize")(function* (input: {
      sessionID: SessionID
      messageID: MessageID
    }) {
      const all = yield* sessions.messages({ sessionID: input.sessionID })
      if (!all.length) return

      const entries: string[] = []
      for (const msg of all) {
        if (msg.info.role !== "assistant") continue
        for (const part of msg.parts) {
          if (part.type !== "tool" || part.state.status !== "completed") continue
          const args = typeof part.state.input === "string" ? JSON.parse(part.state.input) : part.state.input
          switch (part.tool) {
            case "scene":
              if (args.action === "create") entries.push(`Scene set: ${args.title}`)
              if (args.action === "narrate" && args.content) entries.push(args.content.slice(0, 200))
              if (args.action === "speak" && args.content) entries.push(`[${args.character_id}] ${args.content.slice(0, 200)}`)
              break
            case "character":
              if (args.action === "create" && args.name) entries.push(`Character introduced: ${args.name}`)
              if (args.action === "set_player") entries.push("Player character set")
              break
            case "lore":
              if (args.action === "create" && args.title) entries.push(`Lore recorded: ${args.title}`)
              break
            case "roll":
              break
          }
        }
      }

      if (!entries.length) return

      const narrative = entries.join("\n")
      yield* sessions.setSummary({
        sessionID: input.sessionID,
        summary: { narrative },
      })
    })

    const computeDiff = Effect.fn("SessionSummary.computeDiff")(function* () {
      return [] as Snapshot.FileDiff[]
    })

    const diff = Effect.fn("SessionSummary.diff")(function* () {
      return [] as Snapshot.FileDiff[]
    })

    return Service.of({ summarize, diff, computeDiff })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Session.defaultLayer),
    Layer.provide(Bus.layer),
  ),
)

export const DiffInput = z.object({
  sessionID: SessionID.zod,
  messageID: MessageID.zod.optional(),
})

export * as SessionSummary from "./summary"
