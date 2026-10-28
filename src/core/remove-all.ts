// Removes every match of `pattern` (a /g regex) until none is left, so the
// pieces around an inner match ("<scr<b>ipt>", "<!<!---->--") cannot join back up.
export const removeAll = (text: string, pattern: RegExp): string => {
  let out = text
  let prev: string
  do {
    prev = out
    out = out.replace(pattern, '')
  } while (out !== prev)
  return out
}
