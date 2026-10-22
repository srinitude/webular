#!/usr/bin/env bash
# Round-trips a dummy folder through private-crypt.sh. Scratch lives in the working folder.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="$(mktemp -d "$PWD/.private-crypt-test-XXXXXX")"
trap 'rm -rf "$base"' EXIT
export WEBULAR_BENCH_PRIVATE_DIR="$base/private" WEBULAR_BENCH_TEST_ONLY_PASSPHRASE=test-pass
archive="$base/out/p.tar.enc"
mkdir "$base/private"
echo '{"x":1}' > "$base/private/a.jsonl"
bash "$here/private-crypt.sh" encrypt "$archive"
if bash "$here/private-crypt.sh" decrypt "$archive" 2>/dev/null; then echo "FAIL: overwrote non-empty dir"; exit 1; fi
rm -rf "$base/private"
bash "$here/private-crypt.sh" decrypt "$archive"
[ "$(cat "$base/private/a.jsonl")" = '{"x":1}' ] || { echo "FAIL: content differs"; exit 1; }
echo "PASS: private-crypt round trip"
