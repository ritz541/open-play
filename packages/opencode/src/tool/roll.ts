import z from "zod"
import { Effect } from "effect"
import * as Tool from "../tool/tool"

const Parameters = z.object({
  dice: z.string().describe("Dice notation, e.g. '2d6', '1d20', '3d8+2', or a flat number like '5'"),
})

function parseAndRoll(dice: string): { result: number; breakdown: string } | null {
  const trimmed = dice.trim().toLowerCase()

  // Flat number
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return { result: n, breakdown: String(n) }
  }

  // NdM or NdM+K or NdM-K
  const match = trimmed.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/)
  if (!match) return null

  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const modSign = match[3]
  const modValue = match[4] ? parseInt(match[4], 10) : 0

  if (count < 1 || sides < 1 || count > 100) return null

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const rawSum = rolls.reduce((a, b) => a + b, 0)
  const total = modSign === "-" ? rawSum - modValue : rawSum + modValue

  const rollStrs = rolls.map(String)
  let breakdown = `${count}d${sides}: [${rollStrs.join(", ")}]`
  if (rolls.length > 1) breakdown += ` = ${rawSum}`
  if (modValue > 0) breakdown += ` ${modSign} ${modValue} = ${total}`

  return { result: total, breakdown }
}

export const RollTool = Tool.define(
  "roll",
  Effect.gen(function* () {
    const meta = (id?: string) => ({ id })

    return {
      description: [
        "Roll dice or generate a random number.",
        "Supports standard dice notation: '2d6', '1d20', '3d8+2', '1d100'.",
        "Also accepts flat numbers: '5' returns 5.",
        "Use this when the outcome of an action is uncertain.",
      ].join("\n"),

      parameters: Parameters,

      execute: (args: z.infer<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const result = parseAndRoll(args.dice)
          if (!result) {
            return {
              title: "Invalid roll",
              metadata: meta(),
              output: `Invalid dice notation: "${args.dice}". Use format like '2d6', '1d20', or '3d8+2'.`,
            }
          }

          return {
            title: `Rolled ${args.dice}: ${result.result}`,
            metadata: meta(),
            output: `**${args.dice}** → **${result.result}**\n_${result.breakdown}_`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
