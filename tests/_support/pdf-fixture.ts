// A valid PDF of `pages` pages, built in memory. Each page draws "page N" in
// Helvetica, so text extraction returns one line per page it reached.
export const textPdf = (pages: number) => {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const kids: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = objs.length + 1
    kids.push(`${page} 0 R`)
    const res = '/Resources << /Font << /F1 3 0 R >> >>'
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 99 99] ${res} /Contents ${page + 1} 0 R >>`,
    )
    const draw = `BT /F1 9 Tf 9 9 Td (page ${i}) Tj ET`
    objs.push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return `${String(at).padStart(10, '0')} 00000 n \n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}

// A letter-size PDF with one text line per entry, top to bottom, on each page.
export const linesPdf = (pages: string[][]) => {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const draw = (lines: string[]) =>
    lines.map((l, k) => `BT /F1 10 Tf 72 ${740 - 14 * k} Td (${esc(l)}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const kids = pages.map((lines) => {
    const page = objs.length + 1
    const res = '/Resources << /Font << /F1 3 0 R >> >>'
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${res} /Contents ${page + 1} 0 R >>`,
    )
    const body = draw(lines)
    objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`)
    return `${page} 0 R`
  })
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return `${String(at).padStart(10, '0')} 00000 n \n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}
