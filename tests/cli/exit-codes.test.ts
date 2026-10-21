// Error-to-exit-code mapping at the CLI edge: each tagged error class lands on
// the exit code the README documents; unknown failures stay 1.
import { describe, expect, test } from 'bun:test'
import { CliError, failureOf } from '../../src/core/effect.ts'
import { ProcError } from '../../src/core/proc.ts'

describe('failureOf — tagged error to exit code', () => {
  test('CliError keeps its own code, usage errors are 2', () => {
    expect(failureOf(new CliError({ message: 'bad flag', exitCode: 2 }))).toEqual({
      message: 'bad flag',
      exitCode: 2,
    })
    expect(failureOf(new CliError({ message: 'boom', exitCode: 1 })).exitCode).toBe(1)
  })

  test('ProcError (toolchain missing) is 127', () => {
    expect(failureOf(new ProcError({ message: 'mise: not found' }))).toEqual({
      message: 'mise: not found',
      exitCode: 127,
    })
  })

  test('any other failure is 1', () => {
    expect(failureOf(new Error('x')).exitCode).toBe(1)
    expect(failureOf('plain').exitCode).toBe(1)
  })
})
