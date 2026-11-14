#!/usr/bin/env bash
# One command: build, single-file preview, and the two zips (site to deploy, source to keep).
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./package.json').version")
npx vite build
SINGLE=1 npx vite build
mkdir -p out && rm -f out/*.zip
(cd dist && zip -qr "../out/cardamom-site-$V.zip" .)
zip -qr "out/cardamom-source-$V.zip" . -x 'node_modules/*' 'dist/*' 'dist-single/*' 'out/*' 'shots/*' '.git/*' 'test-results/*'
ls -la out
