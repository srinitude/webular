// AST limits analyzer (real TypeScript parser). Enforces the project rules:
// <=200 lines/file, <=30 lines/construct, control-flow nesting depth <=3.
// Nesting counts only control-flow (not function/callback bodies), so test
// nesting is naturally measured relative to the test() declaration.
import { readFileSync } from 'node:fs'
import { Glob } from 'bun'
import ts from 'typescript'

export interface Violation {
  file: string
  kind: 'file' | 'construct' | 'nesting'
  detail: string
}

const ROOTS = ['src', 'bin', 'tests']
const LIMITS = { file: 200, construct: 30, nesting: 3 }

const CONSTRUCTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
])

const NESTERS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.CatchClause,
])

export function listFiles(repo: string): string[] {
  const out: string[] = []
  for (const dir of ROOTS) {
    for (const f of new Glob('**/*.ts').scanSync({ cwd: `${repo}/${dir}`, absolute: true })) {
      out.push(f)
    }
  }
  return out
}

function span(node: ts.Node, sf: ts.SourceFile): number {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
  return sf.getLineAndCharacterOfPosition(node.getEnd()).line - start + 1
}

const TEST_APIS = new Set([
  'describe',
  'test',
  'it',
  'suite',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
])

function isTestCallback(node: ts.Node): boolean {
  const parent = node.parent
  if (!parent || !ts.isCallExpression(parent)) return false
  const callee = parent.expression
  if (ts.isIdentifier(callee)) return TEST_APIS.has(callee.text)
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    return TEST_APIS.has(callee.expression.text)
  }
  return false
}

function checkConstructs(sf: ts.SourceFile, rel: string, out: Violation[]): void {
  const visit = (node: ts.Node): void => {
    const lines = CONSTRUCTS.has(node.kind) && !isTestCallback(node) ? span(node, sf) : 0
    if (lines > LIMITS.construct) {
      out.push({
        file: rel,
        kind: 'construct',
        detail: `${ts.SyntaxKind[node.kind]} spans ${lines} lines`,
      })
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
}

function deepest(node: ts.Node, depth: number): number {
  let max = depth
  ts.forEachChild(node, (child) => {
    max = Math.max(max, deepest(child, NESTERS.has(child.kind) ? depth + 1 : depth))
  })
  return max
}

export function analyzeFile(file: string, rel: string): Violation[] {
  const src = readFileSync(file, 'utf8')
  const out: Violation[] = []
  const lines = src.split('\n').length
  if (lines > LIMITS.file) out.push({ file: rel, kind: 'file', detail: `${lines} lines` })
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
  checkConstructs(sf, rel, out)
  const nesting = deepest(sf, 0)
  if (nesting > LIMITS.nesting) out.push({ file: rel, kind: 'nesting', detail: `depth ${nesting}` })
  return out
}
