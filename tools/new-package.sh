#!/bin/bash

BASE_DIR=$(cd "$(dirname "$0")" || exit; pwd)/..

PKG_NAME=$1

if [ -z "$PKG_NAME" ]; then
  echo "Usage $0 <package_name>"
  exit 0
fi

PKG_DIR=$BASE_DIR/packages/$PKG_NAME
VERSION=$(jq -r .version < "$BASE_DIR/lerna.json")

if [ -d "$PKG_DIR" ]; then
  echo "$PKG_NAME already exists."
  exit 1
fi

mkdir -p "$PKG_DIR"
mkdir -p "$PKG_DIR/src"

cat << JSON > "$PKG_DIR/package.json"
{
  "name": "@croquette/$PKG_NAME",
  "version": "$VERSION",
  "description": "",
  "main": "./lib/cjs/index.js",
  "types": "./lib/types/index.d.ts",
  "exports": {
    "import": "./lib/esm/index.js",
    "require": "./lib/cjs/index.js"
  },
  "scripts": {
    "test": "jest"
  },
  "keywords": [],
  "author": "Quramy",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/croquette-ql/croquette.git",
    "directory": "packages/$PKG_NAME"
  },
  "homepage": "https://github.com/croquette-ql/croquette",
  "devDependencies": {
    "@types/jest": "^26.0.19",
    "jest": "^26.6.3",
    "ts-jest": "^26.4.4",
    "typescript": "^4.1.3"
  }
}
JSON

cat << JSON > "$PKG_DIR/tsconfig.esm.json"
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "esnext",
    "rootDir": "src",
    "outDir": "lib/esm"
  },
  "references": [],
  "exclude": ["node_modules", "lib"]
}
JSON

cat << JSON > "$PKG_DIR/tsconfig.json"
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "lib/types",
    "rootDir": "src",
    "outDir": "lib/cjs"
  },
  "references": [],
  "exclude": ["node_modules", "lib"]
}
JSON

cat << TYPESCRIPT > "$PKG_DIR/src/index.ts"
export function main() {
  return '$PKG_NAME';
}
TYPESCRIPT

cat << MARKDOWN > "$PKG_DIR/README.md"
# @croquette/$PKG_NAME

_T.B.D._
MARKDOWN

cat << IGNORE > "$PKG_DIR/.npmignore"
IGNORE

cat << JS > "$PKG_DIR/jest.config.js"
const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
};
JS
