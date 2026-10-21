#!/bin/sh
# webular installer: picks the release asset for this OS, CPU, and libc,
# checks it against the release's SHA256SUMS, and installs it as
# ${WEBULAR_INSTALL:-$HOME/.webular}/bin/webular.
#   curl -fsSL https://github.com/srinitude/webular/releases/latest/download/install.sh | sh
# WEBULAR_VERSION=<x.y.z> pins a release. WEBULAR_BASE_URL replaces the download
# folder (any curl URL, file:// included). WEBULAR_VERIFY_ATTESTATION=1 also
# runs `gh attestation verify` and fails on a bad or missing attestation.
set -eu

repo=srinitude/webular
fail() { echo "webular install: $*" >&2; exit 1; }

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported OS $(uname -s); on Windows use Scoop or npm" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "unsupported CPU $(uname -m)" ;;
esac
# An x64 shell under Rosetta still gets the native arm64 build.
if [ "$os$arch" = darwinx64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi
suffix=
if [ "$os" = linux ] && ls /lib/ld-musl-* >/dev/null 2>&1; then suffix=-musl; fi
asset="webular-$os-$arch$suffix"

if [ -n "${WEBULAR_VERSION:-}" ]; then
  default="https://github.com/$repo/releases/download/v$WEBULAR_VERSION"
else
  default="https://github.com/$repo/releases/latest/download"
fi
base="${WEBULAR_BASE_URL:-$default}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM
fetch() {
  if command -v curl >/dev/null; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null; then wget -qO "$2" "$1"
  else fail "needs curl or wget"; fi
}
fetch "$base/$asset" "$tmp/$asset" || fail "download failed: $base/$asset"
fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS" || fail "download failed: $base/SHA256SUMS"

want="$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS")"
[ -n "$want" ] || fail "no checksum for $asset in SHA256SUMS"
if command -v sha256sum >/dev/null; then got="$(sha256sum "$tmp/$asset" | awk '{ print $1 }')"
else got="$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')"; fi
[ "$got" = "$want" ] || fail "checksum mismatch for $asset (want $want, got $got)"

if [ "${WEBULAR_VERIFY_ATTESTATION:-0}" = 1 ]; then
  command -v gh >/dev/null || fail "WEBULAR_VERIFY_ATTESTATION=1 needs gh"
  gh attestation verify "$tmp/$asset" --repo "$repo" >&2 || fail "attestation check failed"
fi

dir="${WEBULAR_INSTALL:-$HOME/.webular}/bin"
mkdir -p "$dir"
chmod 755 "$tmp/$asset"
mv "$tmp/$asset" "$dir/webular"
echo "webular installed to $dir/webular"
case ":$PATH:" in *":$dir:"*) ;; *) echo "add $dir to your PATH" ;; esac
