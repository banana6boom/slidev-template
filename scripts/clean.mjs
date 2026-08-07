#!/usr/bin/env node
/**
 * Удаляет результаты сборки: корневой dist/ и presentations/<имя>/dist/.
 *
 *   pnpm clean
 */

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

import { PRESENTATIONS_DIR, ROOT } from './shared.mjs'

const targets = [join(ROOT, 'dist')]

if (existsSync(PRESENTATIONS_DIR)) {
  for (const entry of readdirSync(PRESENTATIONS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory())
      targets.push(join(PRESENTATIONS_DIR, entry.name, 'dist'))
  }
}

const removed = []
for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
    removed.push(relative(ROOT, target))
  }
}

if (removed.length === 0)
  console.log('Удалять нечего: результатов сборки нет')
else
  console.log(`✔ Удалено: ${removed.join(', ')}`)
