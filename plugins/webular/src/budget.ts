// Output limits for every tool result, in one place.
// 8,000 characters stays under Gemini CLI's 40,000-character cut and Claude
// Code's 10,000-token warning even for the densest text: escaped JSON
// (about 1.9 characters per token) and CJK (about 0.9 characters per token).
export const MAX_OUTPUT_CHARS = 8_000

// Returns the result as is when its JSON fits and no cursor is given. Else
// returns one page of that JSON, starting at `from`, marked `truncated: true`,
// with `cursor` set to where the next page starts while any text is left.
// ponytail: each page reruns the command (the CLI's HTTP disk cache keeps that
// cheap); move to one cap and cursor in the CLI's output module when it has one.
export const cap = <A extends object>(result: A, name = 'the tool', from = 0) => {
  const json = JSON.stringify(result) ?? ''
  if (from === 0 && json.length <= MAX_OUTPUT_CHARS) return result
  const end = from + MAX_OUTPUT_CHARS
  const text = json.slice(from, end)
  if (end >= json.length) return { truncated: true, text }
  return {
    truncated: true,
    cursor: end,
    next: `Output was cut at ${MAX_OUTPUT_CHARS} characters. Call ${name} again with the same input and cursor ${end} for the rest.`,
    text,
  }
}
