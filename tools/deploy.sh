#!/usr/bin/env bash
# Build, publish into docs/, commit, and make a bundle for Claude to push.
# Usage: bash tools/deploy.sh "Release v1.9.0"
set -e
cd "$(dirname "$0")/.."
MSG="${1:?Give a commit message}"

echo "==> building"
npx vite build

echo "==> publishing into docs/"
rm -f docs/assets/*
cp -r dist/. docs/
touch docs/.nojekyll

echo "==> secret scan"
PAT="AIza[A-Za-z0-9_-]{20,}|serv""ice_role|sb_""secret_[A-Za-z0-9_-]+"
if grep -rEo "$PAT" --exclude-dir=.git --exclude-dir=node_modules \
     --exclude=deploy.sh . | head -3 | grep -q .; then
  echo "REFUSING: a secret-shaped string is in the tree." >&2
  grep -rEon "$PAT" --exclude-dir=.git --exclude-dir=node_modules \
    --exclude=deploy.sh . | head -5 >&2
  exit 1
fi

echo "==> committing"
git add -A
git commit -q -m "$MSG" || echo "    (nothing to commit)"

echo "==> bundling for push"
mkdir -p out
rm -f out/deploy.bundle
git bundle create out/deploy.bundle origin/main..main 2>/dev/null \
  || git bundle create out/deploy.bundle main

echo "==> done: $(git log --oneline -1)"
echo "    out/deploy.bundle ready for Claude to push"
