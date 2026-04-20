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
  participants: string[] // character IDs
  current_narrator: string // character ID or "narrator"
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

export interface WorldState {
  id: string
  name: string
  description: string
  active_scene_id?: string
  active_character_ids: string[]
  created_at: string
  updated_at: string
}

// Ensure data directory exists
const ensureDir = Effect.gen(function* () {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, "characters"),
    path.join(DATA_DIR, "lore"),
    path.join(DATA_DIR, "scenes"),
    path.join(DATA_DIR, "worlds"),
  ]
  for (const dir of dirs) {
    yield* Effect.promise(() => fs.mkdir(dir, { recursive: true }))
  }
})

// Generic CRUD for JSON files
function readJson<T>(filePath: string): Effect.Effect<T, Error> {
  return Effect.tryPromise({
    try: async () => {
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data) as T
    },
    catch: (e) => new Error(`Failed to read ${filePath}: ${e}`),
  })
}

function writeJson<T>(filePath: string, data: T): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
    },
    catch: (e) => new Error(`Failed to write ${filePath}: ${e}`),
  })
}

function listDir(dirPath: string): Effect.Effect<string[], Error> {
  return Effect.tryPromise({
    try: () => fs.readdir(dirPath),
    catch: (e) => new Error(`Failed to read directory ${dirPath}: ${e}`),
  })
}

function deleteFile(filePath: string): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () => fs.unlink(filePath),
    catch: (e) => new Error(`Failed to delete ${filePath}: ${e}`),
  })
}

// Character operations
export const CharacterStore = {
  dir: path.join(DATA_DIR, "characters"),

  list: Effect.gen(function* () {
    yield* ensureDir
    const files = yield* listDir(CharacterStore.dir)
    const jsonFiles = files.filter((f) => f.endsWith(".json"))
    const characters: Character[] = []
    for (const file of jsonFiles) {
      const char = yield* readJson<Character>(path.join(CharacterStore.dir, file))
      characters.push(char)
    }
    return characters.sort((a, b) => a.name.localeCompare(b.name))
  }),

  get: (id: string) =>
    Effect.gen(function* () {
      yield* ensureDir
      return yield* readJson<Character>(path.join(CharacterStore.dir, `${id}.json`))
    }),

  save: (char: Character) =>
    Effect.gen(function* () {
      yield* ensureDir
      char.updated_at = new Date().toISOString()
      yield* writeJson(path.join(CharacterStore.dir, `${char.id}.json`), char)
    }),

  delete: (id: string) =>
    Effect.gen(function* () {
      yield* deleteFile(path.join(CharacterStore.dir, `${id}.json`))
    }),
}

// Lore operations
export const LoreStore = {
  dir: path.join(DATA_DIR, "lore"),

  list: Effect.gen(function* () {
    yield* ensureDir
    const files = yield* listDir(LoreStore.dir)
    const jsonFiles = files.filter((f) => f.endsWith(".json"))
    const entries: LoreEntry[] = []
    for (const file of jsonFiles) {
      const entry = yield* readJson<LoreEntry>(path.join(LoreStore.dir, file))
      entries.push(entry)
    }
    return entries.sort((a, b) => a.title.localeCompare(b.title))
  }),

  get: (id: string) =>
    Effect.gen(function* () {
      yield* ensureDir
      return yield* readJson<LoreEntry>(path.join(LoreStore.dir, `${id}.json`))
    }),

  save: (entry: LoreEntry) =>
    Effect.gen(function* () {
      yield* ensureDir
      entry.updated_at = new Date().toISOString()
      yield* writeJson(path.join(LoreStore.dir, `${entry.id}.json`), entry)
    }),

  delete: (id: string) =>
    Effect.gen(function* () {
      yield* deleteFile(path.join(LoreStore.dir, `${id}.json`))
    }),

  search: (query: string) =>
    Effect.gen(function* () {
      const entries = yield* LoreStore.list
      const q = query.toLowerCase()
      return entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      )
    }),
}

// Scene operations
export const SceneStore = {
  dir: path.join(DATA_DIR, "scenes"),

  list: Effect.gen(function* () {
    yield* ensureDir
    const files = yield* listDir(SceneStore.dir)
    const jsonFiles = files.filter((f) => f.endsWith(".json"))
    const scenes: Scene[] = []
    for (const file of jsonFiles) {
      const scene = yield* readJson<Scene>(path.join(SceneStore.dir, file))
      scenes.push(scene)
    }
    return scenes.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }),

  get: (id: string) =>
    Effect.gen(function* () {
      yield* ensureDir
      return yield* readJson<Scene>(path.join(SceneStore.dir, `${id}.json`))
    }),

  save: (scene: Scene) =>
    Effect.gen(function* () {
      yield* ensureDir
      scene.updated_at = new Date().toISOString()
      yield* writeJson(path.join(SceneStore.dir, `${scene.id}.json`), scene)
    }),

  delete: (id: string) =>
    Effect.gen(function* () {
      yield* deleteFile(path.join(SceneStore.dir, `${id}.json`))
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
