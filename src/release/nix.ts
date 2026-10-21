// Release step (after the SHA256SUMS step): turns the version and SHA256SUMS
// into a callPackage-style Nix derivation (webular.nix) that fetches this
// release's binary for each supported system and installs it as bin/webular.
// Adding it to nixpkgs or a flake stays a manual step.
import { Effect } from 'effect'
import type { Target } from '../core/platform.ts'
import { brewTargets, releaseUrl, sumFor } from './distribution.ts'

const NIX_CPU = { x64: 'x86_64', arm64: 'aarch64' } as const

const entry = (version: string, sums: ReadonlyMap<string, string>, target: Target) =>
  Effect.map(sumFor(sums, target), ({ asset, sha }) =>
    [
      `    ${NIX_CPU[target.cpu]}-${target.os} = {`,
      `      url = "${releaseUrl(version, asset)}";`,
      `      sha256 = "${sha}";`,
      '    };',
    ].join('\n'),
  )

// The per-system table and the system pick.
const head = (entries: readonly string[]): string[] => [
  '{ lib, stdenv, fetchurl, autoPatchelfHook }:',
  '',
  'let',
  '  sources = {',
  ...entries,
  '  };',
  '  system = stdenv.hostPlatform.system;',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Nix interpolation, not JavaScript
  '  source = sources.${system} or (throw "webular: unsupported system ${system}");',
  'in',
]

// The derivation: fetch, keep the binary whole, install it as bin/webular.
const derivation = (version: string): string[] => [
  'stdenv.mkDerivation {',
  '  pname = "webular";',
  `  version = "${version}";`,
  '',
  '  src = fetchurl { inherit (source) url sha256; };',
  '  dontUnpack = true;',
  // Stripping must keep the script payload Bun appends to its executable.
  '  dontStrip = true;',
  '  nativeBuildInputs = lib.optionals stdenv.hostPlatform.isLinux [ autoPatchelfHook ];',
  '  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ stdenv.cc.cc.lib ];',
  '',
  "  installPhase = ''",
  '    runHook preInstall',
  '    install -Dm755 $src $out/bin/webular',
  '    runHook postInstall',
  "  '';",
  '',
  '  meta = {',
  '    description = "Universal web research CLI";',
  '    homepage = "https://github.com/srinitude/webular";',
  '    license = lib.licenses.asl20;',
  '    mainProgram = "webular";',
  '    platforms = builtins.attrNames sources;',
  '  };',
  '}',
  '',
]

export const nixDerivation = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.map(
    Effect.forEach(brewTargets, (t) => entry(version, sums, t), { concurrency: 4 }),
    (e) => [...head(e), ...derivation(version)].join('\n'),
  )
