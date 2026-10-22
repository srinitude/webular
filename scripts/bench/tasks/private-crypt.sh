#!/usr/bin/env bash
# Usage: private-crypt.sh encrypt|decrypt [archive-path]
# Encrypts bench/tasks/private into one archive outside git; passphrase comes from the macOS Keychain.
set -euo pipefail
mode="${1:-}"
archive="${2:-$HOME/.local/share/webular-bench/private.tar.enc}"
root="$(cd "$(dirname "$0")/../../.." && pwd)"
dir="${WEBULAR_BENCH_PRIVATE_DIR:-$root/bench/tasks/private}"
# Test-only override; the Keychain is the real source.
pass="${WEBULAR_BENCH_TEST_ONLY_PASSPHRASE:-}"
if [ -z "$pass" ]; then
  pass="$(security find-generic-password -s webular-bench-private -w 2>/dev/null)" || {
    echo 'Keychain item webular-bench-private is missing. Create it with: security add-generic-password -s webular-bench-private -a "$USER" -w' >&2
    exit 1
  }
fi
# Passphrase travels on fd 3, never argv; tar data uses stdin/stdout.
cipher=(openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass fd:3)
case "$mode" in
  encrypt)
    [ -d "$dir" ] || { echo "No folder to encrypt: $dir" >&2; exit 1; }
    mkdir -p "$(dirname "$archive")"
    tar -C "$(dirname "$dir")" -cf - "$(basename "$dir")" | "${cipher[@]}" -e -out "$archive" 3<<<"$pass"
    ;;
  decrypt)
    [ -f "$archive" ] || { echo "No archive: $archive" >&2; exit 1; }
    if [ -d "$dir" ] && [ -n "$(ls -A "$dir")" ]; then
      echo "Refusing to overwrite non-empty $dir" >&2
      exit 1
    fi
    mkdir -p "$(dirname "$dir")"
    "${cipher[@]}" -d -in "$archive" 3<<<"$pass" | tar -C "$(dirname "$dir")" -xf -
    ;;
  *) echo "Usage: $0 encrypt|decrypt [archive-path]" >&2; exit 2 ;;
esac
