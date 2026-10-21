// Unused-export analyzer (real TypeScript parser): every `export` in src/
// must be imported somewhere else in src/, bin/ or tests/ — orphaned exports
// are dead surface. Name-based (not path-resolved): a name imported anywhere
// counts everywhere, which errs on the permissive side.

import ts from '@typescript/typescript6'
import { Effect, FileSystem } from 'effect'
import { listFiles } from './limits.ts'

export interface DeadExport {
  file: string
  name: string
}

function hasExport(stmt: ts.Statement): boolean {
  const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function declaredNames(stmt: ts.Statement): string[] {
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations
      .map((d) => (ts.isIdentifier(d.name) ? d.name.text : ''))
      .filter((n) => n.length > 0)
  }
  if (
    ts.isFunctionDeclaration(stmt) ||
    ts.isClassDeclaration(stmt) ||
    ts.isInterfaceDeclaration(stmt) ||
    ts.isTypeAliasDeclaration(stmt) ||
    ts.isEnumDeclaration(stmt)
  ) {
    return stmt.name ? [stmt.name.text] : []
  }
  return []
}

function collectImports(sf: ts.SourceFile, into: Set<string>): void {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    const bindings = stmt.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const el of bindings.elements) into.add((el.propertyName ?? el.name).text)
  }
  collectLazyImports(sf, into)
}

// A call with a lazy loader `() => import('x')` imports `name` when a picker
// `(m) => m.name` rides along, or when the result is destructured:
// `const { name } = yield* load(() => import('x'))`.
const isImportLoader = (arg: ts.Expression): boolean =>
  ts.isArrowFunction(arg) &&
  ts.isCallExpression(arg.body) &&
  arg.body.expression.kind === ts.SyntaxKind.ImportKeyword

const lazyCall = (node: ts.Node | undefined): boolean =>
  node !== undefined && ts.isCallExpression(node) && node.arguments.some(isImportLoader)

const unwrap = (init: ts.Expression): ts.Expression =>
  ts.isYieldExpression(init) || ts.isAwaitExpression(init) ? (init.expression ?? init) : init

function collectLazyImports(node: ts.Node, into: Set<string>): void {
  if (lazyCall(node)) {
    for (const arg of (node as ts.CallExpression).arguments) {
      if (ts.isArrowFunction(arg) && ts.isPropertyAccessExpression(arg.body))
        into.add(arg.body.name.text)
    }
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer &&
    lazyCall(unwrap(node.initializer))
  ) {
    for (const el of node.name.elements) into.add((el.propertyName ?? el.name).getText())
  }
  ts.forEachChild(node, (child) => collectLazyImports(child, into))
}

const parse = (fs: FileSystem.FileSystem, file: string) =>
  Effect.map(fs.readFileString(file), (src) =>
    ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true),
  )

function dead(sources: ts.SourceFile[], repo: string, allow: Set<string>): DeadExport[] {
  const imported = new Set<string>()
  const exported: DeadExport[] = []
  for (const sf of sources) {
    collectImports(sf, imported)
    if (!sf.fileName.includes('/src/')) continue
    for (const stmt of sf.statements) {
      if (!hasExport(stmt)) continue
      for (const name of declaredNames(stmt)) {
        exported.push({ file: sf.fileName.slice(repo.length + 1), name })
      }
    }
  }
  return exported.filter((e) => !imported.has(e.name) && !allow.has(e.name))
}

export const findDeadExports = Effect.fn('findDeadExports')(function* (
  repo: string,
  allow: Set<string>,
) {
  const fs = yield* FileSystem.FileSystem
  const files = yield* listFiles(repo)
  const sources = yield* Effect.forEach(files, (file) => parse(fs, file), { concurrency: 16 })
  return dead(sources, repo, allow)
})
