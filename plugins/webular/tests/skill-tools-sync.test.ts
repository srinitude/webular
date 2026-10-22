// Drift check: the research skill and its tools.md must name the tools and the
// input fields that the server registers (src/schemas.ts and the machine.next
// schema in src/tools/web-machine.ts). Code is the truth; the text follows it.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { machineSchema } from '../../../src/tools/web-machine.ts'
import { schemas } from '../src/schemas.ts'

const skills = fileURLToPath(new URL('../skills/webular-research/', import.meta.url))
const skill = await Bun.file(`${skills}SKILL.md`).text()
const reference = await Bun.file(`${skills}references/tools.md`).text()

const paging = new Set(['cursor', 'select'])
const toolNames = Object.keys(schemas)
const machineKeys = Object.keys(machineSchema.shape).filter((key) => !paging.has(key))

// The `## name` sections of tools.md, each with the fields its Input line names.
const sections = new Map(
  reference
    .split(/^## /m)
    .slice(1)
    .map((body) => [body.split('\n', 1)[0], body.match(/^- Input: (.*)$/m)?.[1] ?? ''] as const),
)
const fieldsOf = (input: string) =>
  [...input.matchAll(/`([\w-]+)`(?= \(| or `)/g)].map((m) => m[1] ?? '').sort()

test('every webular:<tool> in the research skill is a registered tool', () => {
  const named = [...skill.matchAll(/`webular:(\w+)`/g)].map((m) => m[1] ?? '')
  expect(named.filter((name) => !toolNames.includes(name))).toEqual([])
})

test('the research skill names every registered tool', () => {
  expect(toolNames.filter((name) => !skill.includes(`\`webular:${name}\``))).toEqual([])
})

test('each tools.md section lists exactly the input fields of its schema', () => {
  for (const [name, input] of sections) {
    if (name === 'Connect' || name === 'Errors') continue
    const schema =
      name === 'machine.next'
        ? machineKeys
        : Object.keys(schemas[name as keyof typeof schemas]?.shape ?? {})
    expect({ name, fields: fieldsOf(input) }).toEqual({ name, fields: [...schema].sort() })
  }
})

test('tools.md lists every machine that machine.next accepts', () => {
  const input = sections.get('machine.next') ?? ''
  for (const machine of machineSchema.shape.machine.options)
    expect(input).toContain(`\`${machine}\``)
  const listed = [...input.matchAll(/`(\w+)`/g)].map((m) => m[1] ?? '')
  const extras = listed.filter(
    (x) => !['machine', 'events', ...machineSchema.shape.machine.options].includes(x),
  )
  expect(extras).toEqual([])
})
