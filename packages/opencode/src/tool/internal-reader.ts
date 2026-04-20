// open-play: Minimal internal file reader for processing attachments
// This is NOT exposed as an AI tool - it's used internally by the prompt system

import { Effect } from "effect"
import fs from "fs/promises"
import path from "path"
import z from "zod"
import type { Def } from "./tool"

const parameters = z.object({
  filePath: z.string(),
  offset: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
})

type ReadParams = z.infer<typeof parameters>

export function createReadTool(): Def<typeof parameters> {
  return {
    id: "read",
    description: "Internal file reader",
    parameters,
    execute: (args: ReadParams, ctx) =>
      Effect.gen(function* () {
        const filePath = args.filePath
        const offset = args.offset ?? 1
        const limit = args.limit ?? 2000

        const content = yield* Effect.tryPromise({
          try: () => fs.readFile(filePath, "utf-8"),
          catch: (e) => new Error("Failed to read " + filePath + ": " + e),
        }).pipe(Effect.orDie)

        const lines = content.split("\n")
        const start = Math.max(0, offset - 1)
        const end = Math.min(lines.length, start + limit)
        const selected = lines.slice(start, end)

        const output = selected
          .map((line: string, i: number) => (start + i + 1) + "|" + line)
          .join("\n")

        return {
          title: "Read " + path.basename(filePath),
          metadata: {},
          output,
        }
      }),
  }
}
