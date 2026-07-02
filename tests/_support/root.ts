// One authoritative decoded repo root — src/core/root.ts owns the
// fileURLToPath fix (URL.pathname percent-encodes braces/spaces in paths).
export { PACKAGE_ROOT as ROOT } from '../../src/core/root.ts'
