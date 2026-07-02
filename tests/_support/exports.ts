// Unused-export analyzer (real TypeScript parser): every `export` in src/
// must be imported somewhere else in src/, bin/ or tests/ — orphaned exports
// are dead surface. Name-based (not path-resolved): a name imported anywhere
// counts everywhere, which errs on the permissive side.
import { readFileSync } from 'node:fs'
import ts from 'typescript'
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
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
}

export function findDeadExports(repo: string, allow: Set<string>): DeadExport[] {
  const files = listFiles(repo)
  const imported = new Set<string>()
  const exported: DeadExport[] = []
  for (const file of files) {
    const sf = parse(file)
    collectImports(sf, imported)
    if (!file.includes('/src/')) continue
    for (const stmt of sf.statements) {
      if (!hasExport(stmt)) continue
      for (const name of declaredNames(stmt)) {
        exported.push({ file: file.slice(repo.length + 1), name })
      }
    }
  }
  return exported.filter((e) => !imported.has(e.name) && !allow.has(e.name))
}
