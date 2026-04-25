import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { NoteStore, generateId } from "../roleplay/storage"
import type { NoteEntry } from "../roleplay/storage"

const Parameters = z.object({
  action: z.enum(["create", "list", "get", "search", "update", "delete"]).describe("Action to perform"),
  id: z.string().describe("Note ID (required for get, update, delete)").optional(),
  title: z.string().describe("Note title").optional(),
  content: z.string().describe("Note content").optional(),
  tags: z.array(z.string()).describe("Tags for searching").optional(),
  query: z.string().describe("Search query (for search action)").optional(),
})

export const NoteTool = Tool.define(
  "note",
  Effect.gen(function* () {
    const meta = (id?: string) => ({ id })

    return {
      description: [
        "Your internal notebook for tracking story threads, plans, and subplots.",
        "Use this to remember ongoing storylines, character motivations, unresolved mysteries,",
        "planned plot points, or anything else you need to keep consistent across the story.",
        "Notes persist between sessions — use them as the AI's memory.",
      ].join("\n"),

      parameters: Parameters,

      execute: (args: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const action = args.action
          const id = args.id

          if (action === "create") {
            const note: NoteEntry = {
              id: generateId(),
              title: args.title ?? "Untitled Note",
              content: args.content ?? "",
              tags: args.tags ?? [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            yield* NoteStore.save(note)
            return {
              title: `Note: ${note.title}`,
              metadata: meta(note.id),
              output: `**${note.title}** noted! ID: ${note.id}`,
            }
          }

          if (action === "list") {
            const notes = yield* NoteStore.list
            if (notes.length === 0) return { title: "No notes", metadata: meta(), output: "No notes yet." }
            const list = notes
              .map((n: NoteEntry) => `- **${n.title}** [${n.id}] - ${n.content.slice(0, 60)}`)
              .join("\n")
            return { title: `${notes.length} note(s)`, metadata: meta(), output: list }
          }

          if (action === "get") {
            const note = yield* NoteStore.get(id!)
            return {
              title: `Note: ${note.title}`,
              metadata: meta(note.id),
              output: `**${note.title}** [${note.id}]\nTags: ${note.tags.join(", ") || "none"}\n\n${note.content}`,
            }
          }

          if (action === "search") {
            const results = yield* NoteStore.search(args.query ?? "")
            if (results.length === 0) return { title: "No results", metadata: meta(), output: `No matches for '${args.query}'.` }
            const list = results
              .map((n: NoteEntry) => `- **${n.title}** - ${n.content.slice(0, 80)}`)
              .join("\n")
            return { title: `${results.length} result(s)`, metadata: meta(), output: list }
          }

          if (action === "update") {
            const note = yield* NoteStore.get(id!)
            if (args.title) note.title = args.title
            if (args.content) note.content = args.content
            if (args.tags) note.tags = args.tags
            yield* NoteStore.save(note)
            return { title: `Updated: ${note.title}`, metadata: meta(note.id), output: `Note **${note.title}** updated.` }
          }

          if (action === "delete") {
            const note = yield* NoteStore.get(id!)
            yield* NoteStore.delete(id!)
            return { title: `Deleted: ${note.title}`, metadata: meta(note.id), output: `Note **${note.title}** deleted.` }
          }

          return { title: "Unknown action", metadata: meta(), output: `Unknown: ${action}` }
        }).pipe(Effect.orDie),
    }
  }),
)
