// Code limits: files at most 200 lines, functions at most 30 lines, control nesting at most 3 deep.

import ts from '@typescript/typescript6'
import { Effect } from 'effect'
import { files, pluginDir, read, rel, run } from './lib.ts'

const MAX_FILE = 200
const MAX_FUNCTION = 30
const MAX_DEPTH = 3

const isFunction = (n: ts.Node) =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isConstructorDeclaration(n) ||
  ts.isGetAccessorDeclaration(n) ||
  ts.isSetAccessorDeclaration(n)

const isBranch = (n: ts.Node) =>
  ts.isIfStatement(n) ||
  ts.isForStatement(n) ||
  ts.isForInStatement(n) ||
  ts.isForOfStatement(n) ||
  ts.isWhileStatement(n) ||
  ts.isDoStatement(n) ||
  ts.isSwitchStatement(n) ||
  ts.isTryStatement(n)

// An `else if` continues its parent chain, so it adds no depth.
const isElseIf = (n: ts.Node) =>
  ts.isIfStatement(n) && ts.isIfStatement(n.parent) && n.parent.elseStatement === n

export const violations = (path: string, text: string) => {
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const lineOf = (n: ts.Node, end = false) =>
    src.getLineAndCharacterOfPosition(end ? n.getEnd() : n.getStart(src)).line + 1
  const out: string[] = []
  const total = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
  if (total > MAX_FILE)
    out.push(`${rel(path)}:${MAX_FILE + 1}: file has ${total} lines, limit ${MAX_FILE}`)
  const visit = (n: ts.Node, depth: number) => {
    let d = depth
    if (isFunction(n)) {
      d = 0
      const len = lineOf(n, true) - lineOf(n) + 1
      if (len > MAX_FUNCTION)
        out.push(`${rel(path)}:${lineOf(n)}: function has ${len} lines, limit ${MAX_FUNCTION}`)
    } else if (isBranch(n) && !isElseIf(n)) {
      d += 1
      if (d === MAX_DEPTH + 1)
        out.push(`${rel(path)}:${lineOf(n)}: nesting depth ${d}, limit ${MAX_DEPTH}`)
    }
    ts.forEachChild(n, (c) => visit(c, d))
  }
  visit(src, 0)
  return out
}

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const dirs = ['src', 'tests', 'scripts'].map((d) => `${pluginDir}/${d}`)
      const sources = (yield* Effect.forEach(dirs, files, { concurrency: 3 }))
        .flat()
        .filter((f) => /\.tsx?$/.test(f))
      const per = yield* Effect.forEach(
        sources,
        (f) => Effect.map(read(f), (text) => violations(f, text)),
        { concurrency: 16 },
      )
      return per.flat()
    }),
  )
