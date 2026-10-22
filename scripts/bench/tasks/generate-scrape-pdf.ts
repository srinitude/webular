// Minimal PDF writer: a text-layer page, or an image-only page (a 1-bit raster
// of the text in a 5x7 font) that a tool can read only through OCR.
import { CANARY } from './generate-common'

const GLYPHS: Record<string, string> = {
  A: '0e11111f111111',
  B: '1e11111e11111e',
  C: '0e11101010110e',
  D: '1e11111111111e',
  E: '1f10101e10101f',
  F: '1f10101e101010',
  G: '0e11101711110f',
  H: '1111111f111111',
  I: '0e04040404040e',
  J: '0702020202120c',
  K: '11121418141211',
  L: '1010101010101f',
  M: '111b1515111111',
  N: '11111915131111',
  O: '0e11111111110e',
  P: '1e11111e101010',
  Q: '0e11111115120d',
  R: '1e11111e141211',
  S: '0f10100e01011e',
  T: '1f040404040404',
  U: '1111111111110e',
  V: '11111111110a04',
  W: '1111111515150a',
  X: '11110a040a1111',
  Y: '11110a04040404',
  Z: '1f01020408101f',
  ' ': '00000000000000',
}

const SCALE = 3

// Sets one ink dot (SCALE x SCALE pixels) in a DeviceGray 1-bit raster.
const ink = (bytes: Uint8Array, rowBytes: number, px: number, py: number) => {
  for (let i = 0; i < SCALE * SCALE; i++) {
    const x = px * SCALE + (i % SCALE)
    const at = (py * SCALE + Math.floor(i / SCALE)) * rowBytes + (x >> 3)
    bytes[at] = (bytes[at] ?? 0) & ~(0x80 >> (x & 7))
  }
}

const glyphDots = (ch: string) => {
  const g = GLYPHS[ch] ?? GLYPHS[' '] ?? ''
  return Array.from({ length: 35 }, (_, i) => [i % 5, Math.floor(i / 5)] as const).filter(
    ([c, r]) => (Number.parseInt(g.slice(r * 2, r * 2 + 2), 16) >> (4 - c)) & 1,
  )
}

// Packs rows of text into a 1-bit raster: 0 is ink, 1 is paper.
const raster = (lines: ReadonlyArray<string>) => {
  const width = (Math.max(...lines.map((l) => l.length)) * 6 + 2) * SCALE
  const height = (lines.length * 9 + 2) * SCALE
  const rowBytes = Math.ceil(width / 8)
  const bytes = new Uint8Array(rowBytes * height).fill(0xff)
  lines.forEach((line, li) => {
    ;[...line].forEach((ch, ci) => {
      for (const [c, r] of glyphDots(ch)) ink(bytes, rowBytes, 1 + ci * 6 + c, 1 + li * 9 + r)
    })
  })
  return { width, height, bytes }
}

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)

// Assembles objects with a correct xref table so strict readers accept it.
const assemble = (objects: ReadonlyArray<Uint8Array>, title: string) => {
  const parts: Uint8Array[] = [latin1('%PDF-1.4\n')]
  const offsets: number[] = []
  let size = parts[0]?.length ?? 0
  objects.forEach((body, i) => {
    offsets.push(size)
    const chunk = new Uint8Array([...latin1(`${i + 1} 0 obj\n`), ...body, ...latin1('\nendobj\n')])
    parts.push(chunk)
    size += chunk.length
  })
  const info = objects.length + 1
  offsets.push(size)
  const infoChunk = latin1(`${info} 0 obj\n<< /Title (${title}) /Subject (${CANARY}) >>\nendobj\n`)
  parts.push(infoChunk)
  size += infoChunk.length
  const xref = `xref\n0 ${info + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  parts.push(
    latin1(
      `${xref}trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${size}\n%%EOF\n`,
    ),
  )
  return Buffer.concat(parts)
}

const stream = (dict: string, data: Uint8Array) =>
  new Uint8Array([
    ...latin1(`<< ${dict} /Length ${data.length} >>\nstream\n`),
    ...data,
    ...latin1('\nendstream'),
  ])

const pdfText = (s: string) =>
  s.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')

export const textPdf = (title: string, lines: ReadonlyArray<string>) => {
  const ops = lines
    .map((l, i) => `BT /F1 11 Tf 56 ${760 - i * 16} Td (${pdfText(l)}) Tj ET`)
    .join('\n')
  return assemble(
    [
      latin1('<< /Type /Catalog /Pages 2 0 R >>'),
      latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      latin1(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      ),
      stream('', latin1(ops)),
      latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    ],
    pdfText(title),
  )
}

// Uppercase A-Z and spaces only: the raster font has no other glyphs.
export const scannedPdf = (title: string, lines: ReadonlyArray<string>) => {
  const img = raster(lines.map((l) => l.toUpperCase()))
  const w = 540
  const h = Math.round((img.height / img.width) * w)
  return assemble(
    [
      latin1('<< /Type /Catalog /Pages 2 0 R >>'),
      latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      latin1(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>',
      ),
      stream('', latin1(`q ${w} 0 0 ${h} 36 ${740 - h} cm /Im1 Do Q`)),
      stream(
        `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 1`,
        img.bytes,
      ),
    ],
    pdfText(title),
  )
}
