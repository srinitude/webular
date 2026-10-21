// Output limits for every tool result, in one place.
export const MAX_OUTPUT_CHARS = 60_000

// Returns the result as is when its JSON fits, else the first
// MAX_OUTPUT_CHARS of that JSON, marked `truncated: true`.
export const cap = <A extends object>(result: A, name = 'the tool') => {
  const json = JSON.stringify(result) ?? ''
  if (json.length <= MAX_OUTPUT_CHARS) return result
  return {
    truncated: true,
    next: `Output was cut at ${MAX_OUTPUT_CHARS} characters. Call ${name} with a smaller limit, or scrape one URL at a time.`,
    text: json.slice(0, MAX_OUTPUT_CHARS),
  }
}
