interface Spec {
  commands: Readonly<Record<string, string>>
  flags: Readonly<Record<string, readonly string[]>>
  shared: readonly string[]
}

// Flags the CLI still parses but ignores — never offered.
const RETIRED = new Set(['format', 'quiet'])
const unique = (names: readonly string[]) => [...new Set(names)].filter((n) => !RETIRED.has(n))

const sharedOf = (s: Spec) => unique([...s.shared, 'help', 'version'])
const ownOf = (s: Spec, cmd: string) =>
  unique(s.flags[cmd] ?? []).filter((n) => !sharedOf(s).includes(n))
const flagsOf = (s: Spec, cmd: string) =>
  [...ownOf(s, cmd), ...sharedOf(s)].map((name) => `--${name}`)

const names = (s: Spec) => Object.keys(s.commands)
const bashQuote = (t: string) => `'${t.replaceAll("'", "'\\''")}'`
const fishQuote = (t: string) => `'${t.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
const pwshQuote = (t: string) => `'${t.replaceAll("'", "''")}'`

const bash = (s: Spec) =>
  [
    '# bash completion for webular',
    '_webular() {',
    `  local cur="\${COMP_WORDS[COMP_CWORD]}" opts=""`,
    '  if [ "$COMP_CWORD" -le 1 ]; then',
    `    opts="${names(s).join(' ')}"`,
    '  else',
    `    case "\${COMP_WORDS[1]}" in`,
    ...names(s).map((cmd) => `      ${cmd}) opts="${flagsOf(s, cmd).join(' ')}" ;;`),
    '    esac',
    '  fi',
    '  COMPREPLY=($(compgen -W "$opts" -- "$cur"))',
    '}',
    'complete -F _webular webular',
    '',
  ].join('\n')

const zsh = (s: Spec) =>
  [
    '#compdef webular',
    '_webular() {',
    '  local -a cmds',
    '  cmds=(',
    ...names(s).map(
      (cmd) => `    ${bashQuote(`${cmd}:${(s.commands[cmd] ?? '').replaceAll(':', '\\:')}`)}`,
    ),
    '  )',
    '  if (( CURRENT == 2 )); then',
    "    _describe 'command' cmds",
    '    return',
    '  fi',
    '  case $words[2] in',
    ...names(s).map((cmd) => `    ${cmd}) compadd -- ${flagsOf(s, cmd).join(' ')} ;;`),
    '  esac',
    '}',
    '_webular "$@"',
    '',
  ].join('\n')

const fish = (s: Spec) =>
  [
    '# fish completion for webular',
    'complete -c webular -f',
    ...names(s).map(
      (cmd) =>
        `complete -c webular -n __fish_use_subcommand -a ${cmd} -d ${fishQuote(s.commands[cmd] ?? '')}`,
    ),
    ...sharedOf(s).map((flag) => `complete -c webular -l ${flag}`),
    ...names(s).flatMap((cmd) =>
      ownOf(s, cmd).map(
        (flag) => `complete -c webular -n '__fish_seen_subcommand_from ${cmd}' -l ${flag}`,
      ),
    ),
    '',
  ].join('\n')

const pwsh = (s: Spec) =>
  [
    '# PowerShell completion for webular',
    'Register-ArgumentCompleter -Native -CommandName webular -ScriptBlock {',
    '    param($wordToComplete, $commandAst, $cursorPosition)',
    '    $commands = [ordered]@{',
    ...names(s).map((cmd) => `        ${pwshQuote(cmd)} = ${pwshQuote(s.commands[cmd] ?? '')}`),
    '    }',
    '    $flags = @{',
    ...names(s).map((cmd) => `        ${pwshQuote(cmd)} = ${pwshQuote(flagsOf(s, cmd).join(' '))}`),
    '    }',
    '    $words = @($commandAst.CommandElements | ForEach-Object { $_.ToString() })',
    '    $items = @()',
    '    if ($words.Count -le 1 -or ($words.Count -eq 2 -and $wordToComplete -ne "")) {',
    '        $items = $commands.Keys | ForEach-Object { @($_, $commands[$_]) }',
    '    } elseif ($flags.ContainsKey($words[1])) {',
    '        $items = $flags[$words[1]] -split " " | ForEach-Object { @($_, $_) }',
    '    }',
    '    for ($i = 0; $i -lt $items.Count; $i += 2) {',
    '        if ($items[$i] -like "$wordToComplete*") {',
    "            [System.Management.Automation.CompletionResult]::new($items[$i], $items[$i], 'ParameterValue', $items[$i + 1])",
    '        }',
    '    }',
    '}',
    '',
  ].join('\n')

export const completionFiles = (s: Spec) =>
  [
    ['webular.bash', bash(s)],
    ['_webular', zsh(s)],
    ['webular.fish', fish(s)],
    ['webular.ps1', pwsh(s)],
  ] as const
