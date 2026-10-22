// Security: page text in a crop-box payload is data, never instructions.
import { expect, test } from 'bun:test'
import { decideCropBox } from '../../src/lib/jev/decisions/crop-box.ts'
// The rule is held back: on jev-1.14.0 it dropped mean confidence from about 0.41 to 0.35
// and cost one pass in 24 calls. test.failing flips red once the payload carries it.
import { DATA_ONLY, instructionText } from '../../src/lib/jev/payload/index.ts'

test.failing('every crop-box question carries the data-not-instructions rule', () => {
  const { questions } = decideCropBox.def.payload(decideCropBox.def.sample())
  for (const q of Object.values(questions))
    expect(instructionText(q.instructions)).toContain(DATA_ONLY)
})
