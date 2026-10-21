// act --goal planner: plain goal text becomes semantic intents.
import { describe, expect, test } from 'bun:test'
import { planGoal } from '../../src/lib/cua-goal.ts'

const shows = (text: string) => ({ element: { selector: { label_contains: text }, exists: true } })

describe('act --goal planner', () => {
  test('a quoted target with an end text proves the end text', () => {
    expect(planGoal('click "Press me" until it says "Done"')).toEqual([
      { label: 'Press me', expect: shows('Done') },
    ])
  })

  test('unquoted words after click name the target', () => {
    expect(planGoal('Click the Save button')).toEqual([
      { label: 'Save button', expect: shows('Save button') },
    ])
  })

  test('steps split on then; only the last step proves the end text', () => {
    expect(planGoal(`click 'Open' then click Send until it says "Sent"`)).toEqual([
      { label: 'Open', expect: shows('Open') },
      { label: 'Send', expect: shows('Sent') },
    ])
  })

  test('a goal with no target plans nothing', () => {
    expect(planGoal('make it nice')).toEqual([])
  })
})
