// Replay reads the checked-in bench/recordings; live runs write under
// bench/results/recordings so a live run never overwrites checked-in files.
export const replayPath = (root: string, name: string) => `${root}recordings/${name}.json`
export const livePath = (root: string, name: string) => `${root}results/recordings/${name}.json`
