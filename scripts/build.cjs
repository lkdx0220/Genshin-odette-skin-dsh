#!/usr/bin/env node
/**
 * Self-contained build: no DSH_CHECKOUT required, cross-platform (node only).
 * - art:    node 脚本把 assets/ 素材转成 data URI 写入 src/client/art.generated.ts
 * - host:   local tsc (devDependency) compiles src → lib
 * - client: tsdown bundles src/client → lib/client.js（CSS 经 lightningcss 内联）
 * Satisfies the dsh "prepare" contract: runs from a bare clone after npm install.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const bin = p => path.join(root, 'node_modules', '.bin', p)
const run = cmd => {
  console.log('=== ' + cmd + ' ===')
  execSync(cmd, { cwd: root, stdio: 'inherit', shell: true })
}

// 素材内嵌：assets/ → src/client/art.generated.ts（缺素材时脚本自身报错退出）
run('node scripts/generate-art.cjs')

const tsc = fs.existsSync(bin('tsc')) || fs.existsSync(bin('tsc.cmd'))
if (!tsc) {
  console.error('build: local tsc not found — run `npm install` first')
  process.exit(1)
}
run('tsc -p tsconfig.json')

if (fs.existsSync(bin('tsdown')) || fs.existsSync(bin('tsdown.cmd'))) {
  run('npm run build:client')
} else {
  console.warn('build: tsdown not found, skipping client bundle')
}
console.log('=== Build complete ===')
