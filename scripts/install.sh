#!/bin/sh
# webular installer for macOS and Linux. It picks the Bun-built release asset
# for this OS, CPU, libc, and AVX2 support, checks its SHA-256, runs it once,
# and installs it as ${WEBULAR_INSTALL:-$HOME/.webular}/bin/webular.
#   curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
#   curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh -s -- --version <x.y.z>
# Options: --version <x.y.z>, --no-modify-path, --uninstall, --quiet; or their
# twins WEBULAR_VERSION, WEBULAR_NO_MODIFY_PATH=1, WEBULAR_UNINSTALL=1, WEBULAR_QUIET=1.
# WEBULAR_INSTALL sets the install root. WEBULAR_BASE_URL replaces the folder the
# binary comes from (https://, file://, or http:// on loopback); the checksums
# never come from it: the SHA256SUMS baked in at release win, and an unbaked
# copy reads SHA256SUMS from the GitHub release. WEBULAR_BASELINE=1 or 0
# forces or skips the x64 build for CPUs without AVX2. WEBULAR_OS, WEBULAR_ARCH,
# WEBULAR_LIBC override detection. With gh on PATH, `gh attestation verify` runs
# and must pass; without gh, a note says it was skipped.
# WEBULAR_VERIFY_ATTESTATION=1 requires gh, and 0 skips the check.
# WEBULAR_ALLOW_SUDO=1 allows sudo.
# curl and wget read HTTPS_PROXY and NO_PROXY on their own.
set -eu

repo=srinitude/webular
security="https://github.com/$repo/blob/main/SECURITY.md"
default_version='__WEBULAR_VERSION__'
baked_sums='
__WEBULAR_SUMS__
'

fail() { echo "webular install: $*" >&2; exit 1; }
say() { [ "${WEBULAR_QUIET:-0}" = 1 ] || echo "$*"; }

fetch() { # url dest
  case "$1" in file://*) proto='=file' ;; http://*) proto='=http' ;; *) proto='=https' ;; esac
  if command -v curl >/dev/null 2>&1 && ! command -v curl | grep -q /snap/; then
    curl --proto "$proto" --tlsv1.2 --retry 3 -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    if [ "$proto" = '=https' ] && wget --help 2>&1 | grep -q -- --https-only; then
      wget -q --https-only --secure-protocol=TLSv1_2 -O "$2" "$1"
    else wget -q -O "$2" "$1"; fi
  else fail "needs curl or wget; install one and run this again"; fi
}
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{ print $1 }'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{ print $1 }'
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 "$1" | awk '{ print $NF }'
  else fail "no sha256sum, shasum, or openssl to check the download; refusing to install"; fi
}
has_avx2() {
  case "${WEBULAR_BASELINE:-}" in 1) return 1 ;; 0) return 0 ;; esac
  case "$os" in
    linux) grep -qw avx2 /proc/cpuinfo 2>/dev/null ;;
    *) sysctl -n machdep.cpu.leaf7_features 2>/dev/null | grep -qi avx2 ;;
  esac
}
is_musl() {
  case "${WEBULAR_LIBC:-}" in musl) return 0 ;; glibc) return 1 ;; ?*) fail "WEBULAR_LIBC must be glibc or musl" ;; esac
  # glibc first: a glibc distro can carry the musl loader too.
  getconf GNU_LIBC_VERSION >/dev/null 2>&1 && return 1
  ldd --version 2>&1 | grep -qi -e glibc -e 'gnu libc' && return 1
  ls /lib/ld-musl-* >/dev/null 2>&1 || ldd --version 2>&1 | grep -qi musl
}

detect_platform() {
  os="${WEBULAR_OS:-$(uname -s)}" arch="${WEBULAR_ARCH:-$(uname -m)}"
  case "$os" in
    Darwin | darwin) os=darwin ;;
    Linux | linux) os=linux ;;
    MINGW* | MSYS* | CYGWIN*) fail "this is a Windows shell; run: powershell -c \"irm https://webular.dev/install.ps1 | iex\"" ;;
    *) fail "unsupported OS $os; webular ships macOS, Linux, and Windows builds" ;;
  esac
  case "$arch" in
    x86_64 | amd64 | x64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) fail "unsupported CPU $arch; webular ships x64 and arm64 builds" ;;
  esac
  # An x64 shell under Rosetta still gets the native arm64 build.
  if [ -z "${WEBULAR_ARCH:-}" ] && [ "$os$arch" = darwinx64 ] &&
    [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then arch=arm64; fi
  libc='' baseline=''
  if [ "$os" = linux ] && is_musl; then libc=-musl; fi
  if [ "$arch" = x64 ] && ! has_avx2; then baseline=-baseline; fi
  asset="webular-$os-$arch$libc$baseline"
}
parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --version) [ $# -ge 2 ] || fail "--version needs a value, such as 1.2.3"; WEBULAR_VERSION=$2; shift ;;
      --no-modify-path) WEBULAR_NO_MODIFY_PATH=1 ;;
      --uninstall) WEBULAR_UNINSTALL=1 ;;
      --quiet) WEBULAR_QUIET=1 ;;
      *) fail "unknown option $1; options: --version <x.y.z> --no-modify-path --uninstall --quiet" ;;
    esac
    shift
  done
}
resolve_release() {
  version="${WEBULAR_VERSION:-}"
  case "$default_version" in __WEBULAR_*) default_version= ;; esac
  version="${version#v}"
  [ -n "$version" ] || version=$default_version
  if [ -n "$version" ] && ! printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    fail "version must look like 1.2.3, not $version"
  fi
  release="https://github.com/$repo/releases/latest/download"
  [ -z "$version" ] || release="https://github.com/$repo/releases/download/v$version"
  base="${WEBULAR_BASE_URL:-$release}"
  case "$base" in
    https://* | file://* | http://127.0.0.1[:/]* | http://localhost[:/]*) ;;
    *) fail "WEBULAR_BASE_URL must start with https:// (or file://, or http:// on loopback)" ;;
  esac
}
verify_attestation() { # file
  [ "${WEBULAR_VERIFY_ATTESTATION:-}" != 0 ] || return 0
  if ! command -v gh >/dev/null 2>&1; then
    [ "${WEBULAR_VERIFY_ATTESTATION:-}" != 1 ] || fail "WEBULAR_VERIFY_ATTESTATION=1 needs gh; install it from https://cli.github.com"
    say "note: gh is not on PATH, so the build attestation was not checked" >&2
    return 0
  fi
  gh attestation verify "$1" --repo "$repo" \
    --signer-workflow "$repo/.github/workflows/release.yml" >&2 ||
    fail "attestation check failed; do not run it, and report it as $security says"
}
verify_download() { # file
  # Baked sums win; a mirror never supplies its own sums.
  if [ -n "$version" ] && [ "$version" = "$default_version" ]; then
    printf '%s\n' "$baked_sums" > "$tmp/SHA256SUMS"
  else
    fetch "$release/SHA256SUMS" "$tmp/SHA256SUMS" || fail "download failed: $release/SHA256SUMS"
  fi
  want="$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS")"
  printf '%s\n' "$want" | grep -Eq '^[0-9a-f]{64}$' || fail "no checksum for $asset in SHA256SUMS"
  got="$(sha256_of "$1")"
  [ "$got" = "$want" ] ||
    fail "checksum mismatch for $asset (want $want, got $got); do not run it, and report it as $security says"
  verify_attestation "$1"
}

install_binary() {
  if [ "$(id -u)" = 0 ] && [ -n "${SUDO_USER:-}" ] && [ "${WEBULAR_ALLOW_SUDO:-0}" != 1 ]; then
    fail "do not run this under sudo; it installs for your own user (WEBULAR_ALLOW_SUDO=1 overrides)"
  fi
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT INT TERM
  rc=0
  fetch "$base/$asset" "$tmp/$asset" || rc=$?
  case "$rc" in
    0) ;;
    22 | 56 | 8) fail "Release v${version:-latest} not found, or it has no $asset ($base/$asset)" ;;
    *) fail "download failed: $base/$asset; check your network and run this again" ;;
  esac
  verify_download "$tmp/$asset"
  mkdir -p "$dir" || fail "cannot create $dir; set WEBULAR_INSTALL to a folder you own"
  stage="$dir/.webular.new"
  cp "$tmp/$asset" "$stage" && chmod 755 "$stage"
  if ! "$stage" --version >/dev/null 2>&1; then
    rm -f "$stage"
    fail "the downloaded webular does not run here; on an older x64 CPU try WEBULAR_BASELINE=1"
  fi
  mv -f "$stage" "$dir/webular"
  say "webular installed to $dir/webular"
}
rc_files() {
  case "$(basename "${SHELL:-sh}")" in
    zsh) echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) echo "$HOME/.bashrc"; [ "$(uname -s)" != Darwin ] || echo "$HOME/.bash_profile" ;;
    fish) echo "${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/webular.fish" ;;
    *) echo "$HOME/.profile" ;;
  esac
}
update_path() {
  [ -z "${GITHUB_PATH:-}" ] || echo "$dir" >> "$GITHUB_PATH"
  if [ "${WEBULAR_NO_MODIFY_PATH:-0}" = 1 ]; then
    case ":$PATH:" in *":$dir:"*) ;; *) say "add $dir to your PATH" ;; esac
    return 0
  fi
  for rc in $(rc_files); do
    grep -qF '# webular' "$rc" 2>/dev/null && continue
    mkdir -p "$(dirname "$rc")"
    case "$rc" in
      *.fish) echo "fish_add_path \"$dir\" # webular" >> "$rc" ;;
      *) echo "export PATH=\"$dir:\$PATH\" # webular" >> "$rc" ;;
    esac
    say "added $dir to PATH in $rc; open a new shell to use it"
  done
}
warn_if_shadowed() {
  found="$(command -v webular 2>/dev/null || true)"
  [ -z "$found" ] || [ "$found" = "$dir/webular" ] ||
    echo "webular install: warning: $found comes first on PATH and hides $dir/webular" >&2
}
uninstall() {
  rm -f "$dir/webular"
  for rc in "${ZDOTDIR:-$HOME}/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    if grep -qF '# webular' "$rc" 2>/dev/null; then
      grep -vF '# webular' "$rc" > "$rc.webular-tmp" || true; mv -f "$rc.webular-tmp" "$rc"
    fi
  done
  rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/webular.fish"
  say "webular removed from $dir"
}

main() {
  parse_args "$@"
  dir="${WEBULAR_INSTALL:-$HOME/.webular}/bin"
  if [ "${WEBULAR_UNINSTALL:-0}" = 1 ]; then uninstall; return 0; fi
  detect_platform
  if [ "${WEBULAR_PRINT_ASSET:-0}" = 1 ]; then echo "$asset"; return 0; fi
  resolve_release
  install_binary
  update_path
  warn_if_shadowed
}

main "$@"
