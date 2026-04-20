import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool"
import { LoreStore, generateId } from "../roleplay/storage"
import type { LoreEntry } from "../roleplay/storage"

const createParams = z.object({
  action: z.literal("create"),
  title: z.string().describe("Lore entry title"),
  category: z.string().describe("Category: location, faction, item, history, magic, culture, etc."),
  content: z.string().describe("The lore content - be detailed and descriptive"),
  tags: z.array(z.string()).describe("Tags for searching (e.g. ['forest', 'elven', 'sacred'])").default([]),
})

const listParams = z.object({
  action: z.literal("list"),
  category: z.string().describe("Filter by category (optional)").optional(),
})

const getParams = z.object({
  action: z.literal("get"),
  id: z.string().describe("Lore entry ID"),
})

const searchParams = z.object({
  action: z.literal("search"),
  query: z.string().describe("Search query - matches title, content, and tags"),
})

const updateParams = z.object({
  action: z.literal("update"),
  id: z.string().describe("Lore entry ID to update"),
  title: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const deleteParams = z.object({
  action: z.literal("delete"),
  id: z.string().describe("Lore entry ID to delete"),
})

const parameters = z.discriminatedUnion("action", [
  createParams,
  listParams,
  getParams,
  searchParams,
  updateParams,
  deleteParams,
])

export const LoreTool = Tool.define(
  "lore",
  Effect.gen(function* () {
    return {
      description: [
        "Manage the world's lore - locations, factions, items, history, magic systems, culture.",
        "Create entries that define the world the roleplay takes place in.",
        "Search and retrieve lore to inject into scenes and narration.",
        "Tags help cross-reference related lore entries.",
      ].join("\n"),
      parameters,
      execute: (args, ctx) =>
        Effect.gen(function* () {
          switch (args.action) {
            case "create": {
              const entry: LoreEntry = {
                id: generateId(),
                title: args.title,
                category: args.category,
                content: args.content,
                tags: args.tags,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              yield* LoreStore.save(entry)
              return {
                title: `Created lore: ${entry.title}`,
                metadata: { lore_id: entry.id },
                output: [
                  `Lore entry **${entry.title}** created!`,
                  ``,
                  `ID: ${entry.id}`,
                  `Category: ${entry.category}`,
                  `Tags: ${entry.tags.join(", ") || "none"}`,
                ].join("\n"),
              }
            }

            case "list": {
              let entries = yield* LoreStore.list
              if (args.category) {
                entries = entries.filter((e) => e.category === args.category)
              }
              if (entries.length === 0) {
                return {
                  title: "No lore entries",
                  metadata: {},
                  output: args.category
                    ? `No entries in category '${args.category}'.`
                    : "No lore entries yet. Create some to build your world!",
                }
              }
              const byCategory: Record<string, LoreEntry[]> = {}
              for (const e of entries) {
                ;(byCategory[e.category] ??= []).push(e)
              }
              const lines: string[] = []
              for (const [cat, items] of Object.entries(byCategory)) {
                lines.push(`**${cat}:**`)
                for (const item of items) {
                  lines.push(`  - ${item.title} [${item.id}]`)
                }
              }
              return {
                title: `${entries.length} lore entries`,
                metadata: {},
                output: lines.join("\n"),
              }
            }

            case "get": {
              const entry = yield* LoreStore.get(args.id)
              return {
                title: `Lore: ${entry.title}`,
                metadata: { lore: entry },
                output: [
                  `**${entry.title}** [${entry.id}]`,
                  `Category: ${entry.category} | Tags: ${entry.tags.join(", ") || "none"}`,
                  ``,
                  entry.content,
                  ``,
                  `Updated: ${entry.updated_at}`,
                ].join("\n"),
              }
            }

            case "search": {
              const results = yield* LoreStore.search(args.query)
              if (results.length === 0) {
                return {
                  title: "No results",
                  metadata: {},
                  output: `No lore entries match '${args.query}'.`,
                }
              }
              const list = results
                .map((e) => `- **${e.title}** [${e.category}] - ${e.content.slice(0, 100)}...`)
                .join("\n")
              return {
                title: `${results.length} result(s)`,
                metadata: {},
                output: list,
              }
            }

            case "update": {
              const entry = yield* LoreStore.get(args.id)
              if (args.title) entry.title = args.title
              if (args.category) entry.category = args.category
              if (args.content) entry.content = args.content
              if (args.tags) entry.tags = args.tags
              yield* LoreStore.save(entry)
              return {
                title: `Updated lore: ${entry.title}`,
                metadata: { lore: entry },
                output: `Lore entry **${entry.title}** updated!`,
              }
            }

            case "delete": {
              const entry = yield* LoreStore.get(args.id)
              yield* LoreStore.delete(args.id)
              return {
                title: `Deleted lore: ${entry.title}`,
                metadata: {},
                output: `Lore entry **${entry.title}** deleted.`,
              }
            }
          }
        }),
    }
  }),
)
