// A "which country" question wants the country as a noun, so a demonym in
// the answer ("Ukrainian") gets the country noun beside it ("Ukrainian (Ukraine)").
// ponytail: a fixed table of common demonyms; add a row when a bench question
// needs one, or swap in a full demonym list if misses pile up.
const DEMONYMS: Readonly<Record<string, string>> = {
  American: 'United States',
  Australian: 'Australia',
  Austrian: 'Austria',
  Brazilian: 'Brazil',
  British: 'United Kingdom',
  Canadian: 'Canada',
  Chinese: 'China',
  Danish: 'Denmark',
  Dutch: 'Netherlands',
  Egyptian: 'Egypt',
  French: 'France',
  German: 'Germany',
  Greek: 'Greece',
  Indian: 'India',
  Irish: 'Ireland',
  Israeli: 'Israel',
  Italian: 'Italy',
  Japanese: 'Japan',
  Mexican: 'Mexico',
  Norwegian: 'Norway',
  Polish: 'Poland',
  Russian: 'Russia',
  Spanish: 'Spain',
  Swedish: 'Sweden',
  Swiss: 'Switzerland',
  Turkish: 'Turkey',
  Ukrainian: 'Ukraine',
}
const DEMONYM = new RegExp(`\\b(${Object.keys(DEMONYMS).join('|')})\\b(?! \\()`)

export const nameCountry = (query: string, answer: string) =>
  /\bwhich country\b|\bwhat country\b/i.test(query)
    ? answer.replace(DEMONYM, (d) => `${d} (${DEMONYMS[d]})`)
    : answer
