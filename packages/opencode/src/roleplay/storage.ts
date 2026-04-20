// open-play: Roleplay data storage
// Stores characters, lore, scenes, and world state as JSON files

import { Effect } from "effect"
import path from "path"
import os from "os"
import fs from "fs/promises"

const DATA_DIR = path.join(os.homedir(), ".open-play")

export interface Character {
  id: string
  name: string
  persona: string
  personality: string
  speaking_style: string
  background: string
  avatar_url?: string
  voice_id?: string
  created_at: string
  updated_at: string
}

export interface LoreEntry {
  id: string
  title: string
  category: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  title: string
  setting: string
  participants: string[]
  current_narrator: string
  history: SceneMessage[]
  created_at: string
  updated_at: string
}

export interface SceneMessage {
  role: "narrator" | "character" | "player"
  character_id?: string
  content: string
  timestamp: string
}

// Ensure data directory exists
async function ensureDir(): Promise<void> {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, "characters"),
    path.join(DATA_DIR, "lore"),
    path.join(DATA_DIR, "scenes"),
  ]
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const data = await fs.readFile(filePath, "utf-8")
  return JSON.parse(data) as T
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
}

async function listJsonFiles(dirPath: string): Promise<string[]> {
  const files = await fs.readdir(dirPath)
  return files.filter((f: string) => f.endsWith(".json"))
}

// Character operations
export const CharacterStore = {
  dir: path.join(DATA_DIR, "characters"),

  list: Effect.tryPromise({
    try: async () => {
      await ensureDir()
      const files = await listJsonFiles(CharacterStore.dir)
      const characters: Character[] = []
      for (const file of files) {
        const char = await readJsonFile<Character>(path.join(CharacterStore.dir, file))
        characters.push(char)
      }
      return characters.sort((a: Character, b: Character) => a.name.localeCompare(b.name))
    },
    catch: (e) => new Error(`Failed to list characters: ${e}`),
  }),

  get: (id: string) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      return await readJsonFile<Character>(path.join(CharacterStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to get character ${id}: ${e}`),
  }),

  save: (char: Character) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      char.updated_at = new Date().toISOString()
      await writeJsonFile(path.join(CharacterStore.dir, `${char.id}.json`), char)
    },
    catch: (e) => new Error(`Failed to save character: ${e}`),
  }),

  delete: (id: string) => Effect.tryPromise({
    try: async () => {
      await fs.unlink(path.join(CharacterStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to delete character ${id}: ${e}`),
  }),
}

// Lore operations
export const LoreStore = {
  dir: path.join(DATA_DIR, "lore"),

  list: Effect.tryPromise({
    try: async () => {
      await ensureDir()
      const files = await listJsonFiles(LoreStore.dir)
      const entries: LoreEntry[] = []
      for (const file of files) {
        const entry = await readJsonFile<LoreEntry>(path.join(LoreStore.dir, file))
        entries.push(entry)
      }
      return entries.sort((a: LoreEntry, b: LoreEntry) => a.title.localeCompare(b.title))
    },
    catch: (e) => new Error(`Failed to list lore: ${e}`),
  }),

  get: (id: string) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      return await readJsonFile<LoreEntry>(path.join(LoreStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to get lore ${id}: ${e}`),
  }),

  save: (entry: LoreEntry) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      entry.updated_at = new Date().toISOString()
      await writeJsonFile(path.join(LoreStore.dir, `${entry.id}.json`), entry)
    },
    catch: (e) => new Error(`Failed to save lore: ${e}`),
  }),

  delete: (id: string) => Effect.tryPromise({
    try: async () => {
      await fs.unlink(path.join(LoreStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to delete lore ${id}: ${e}`),
  }),

  search: (query: string) => Effect.gen(function* () {
    const entries = yield* LoreStore.list
    const q = query.toLowerCase()
    return entries.filter(
      (e: LoreEntry) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t: string) => t.toLowerCase().includes(q))
    )
  }),
}

// Scene operations
export const SceneStore = {
  dir: path.join(DATA_DIR, "scenes"),

  list: Effect.tryPromise({
    try: async () => {
      await ensureDir()
      const files = await listJsonFiles(SceneStore.dir)
      const scenes: Scene[] = []
      for (const file of files) {
        const scene = await readJsonFile<Scene>(path.join(SceneStore.dir, file))
        scenes.push(scene)
      }
      return scenes.sort((a: Scene, b: Scene) => b.updated_at.localeCompare(a.updated_at))
    },
    catch: (e) => new Error(`Failed to list scenes: ${e}`),
  }),

  get: (id: string) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      return await readJsonFile<Scene>(path.join(SceneStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to get scene ${id}: ${e}`),
  }),

  save: (scene: Scene) => Effect.tryPromise({
    try: async () => {
      await ensureDir()
      scene.updated_at = new Date().toISOString()
      await writeJsonFile(path.join(SceneStore.dir, `${scene.id}.json`), scene)
    },
    catch: (e) => new Error(`Failed to save scene: ${e}`),
  }),

  delete: (id: string) => Effect.tryPromise({
    try: async () => {
      await fs.unlink(path.join(SceneStore.dir, `${id}.json`))
    },
    catch: (e) => new Error(`Failed to delete scene ${id}: ${e}`),
  }),

  addMessage: (sceneId: string, message: SceneMessage) =>
    Effect.gen(function* () {
      const scene = yield* SceneStore.get(sceneId)
      scene.history.push(message)
      yield* SceneStore.save(scene)
      return scene
    }),
}

// Utility: generate a simple unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
