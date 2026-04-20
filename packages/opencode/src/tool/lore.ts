import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"
import { LoreStore, generateId } from "../roleplay/storage"
import type { LoreEntry } from "../roleplay/storage"

export const LoreTool = (Tool.define as any)(
  "lore",
  Effect.gen(function* () {
    return {
      description: [
      "Manage the world's lore - locations, factions, items, history, magic systems, culture.",
      "Create entries that define the world the roleplay takes place in.",
      "Search and retrieve lore to inject into scenes and narration.",
    ].join("\n"),

    parameters: z.object({
      action: z.enum(["create", "list", "get", "search", "update", "delete"]).describe("Action to perform"),
      id: z.string().describe("Lore entry ID (required for get, update, delete)").optional(),
      title: z.string().describe("Lore entry title").optional(),
      category: z.string().describe("Category: location, faction, item, history, magic, culture, etc.").optional(),
      content: z.string().describe("The lore content").optional(),
      tags: z.array(z.string()).describe("Tags for searching").optional(),
      query: z.string().describe("Search query (for search action)").optional(),
    }),

    execute: (args: any, ctx: any) =>
      Effect.gen(function* () {
        const action = args.action as string

        if (action === "create") {
          const entry: LoreEntry = {
            id: generateId(),
            title: args.title ?? "Untitled",
            category: args.category ?? "general",
            content: args.content ?? "",
            tags: args.tags ?? [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          yield* LoreStore.save(entry)
          return {
            title: `Created lore: ${entry.title}`,
            metadata: { lore_id: entry.id },
            output: `Lore entry **${entry.title}** created! ID: ${entry.id}\nCategory: ${entry.category}`,
          }
        }

        if (action === "list") {
          let entries = yield* LoreStore.list
          if (args.category) entries = entries.filter((e: LoreEntry) => e.category === args.category)
          if (entries.length === 0) return { title: "No lore entries", metadata: {}, output: "No lore entries yet." }
          const byCat: Record<string, LoreEntry[]> = {}
          for (const e of entries) { (byCat[e.category] ??= []).push(e) }
          const lines: string[] = []
          for (const [cat, items] of Object.entries(byCat)) {
            lines.push(`**${cat}:**`)
            for (const item of items) lines.push(`  - ${item.title} [${item.id}]`)
          }
          return { title: `${entries.length} entries`, metadata: {}, output: lines.join("\n") }
        }

        if (action === "get") {
          const entry = yield* LoreStore.get(args.id)
          return {
            title: `Lore: ${entry.title}`,
            metadata: { lore: entry },
            output: `**${entry.title}** [${entry.id}]\nCategory: ${entry.category}\n\n${entry.content}`,
          }
        }

        if (action === "search") {
          const results = yield* LoreStore.search(args.query ?? "")
          if (results.length === 0) return { title: "No results", metadata: {}, output: `No matches for '${args.query}'.` }
          const list = results.map((e: LoreEntry) => `- **${e.title}** [${e.category}] - ${e.content.slice(0, 80)}...`).join("\n")
          return { title: `${results.length} result(s)`, metadata: {}, output: list }
        }

        if (action === "update") {
          const entry = yield* LoreStore.get(args.id)
          if (args.title) entry.title = args.title
          if (args.category) entry.category = args.category
          if (args.content) entry.content = args.content
          if (args.tags) entry.tags = args.tags
          yield* LoreStore.save(entry)
          return { title: `Updated: ${entry.title}`, metadata: {}, output: `Lore **${entry.title}** updated!` }
        }

        if (action === "delete") {
          const entry = yield* LoreStore.get(args.id)
          yield* LoreStore.delete(args.id)
          return { title: `Deleted: ${entry.title}`, metadata: {}, output: `Lore **${entry.title}** deleted.` }
        }

        return { title: "Unknown action", metadata: {}, output: "Unknown: " + action }
      }),
    }
  }),
)
