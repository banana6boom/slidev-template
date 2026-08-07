#!/usr/bin/env node
/**
 * Сборка всех презентаций разом в dist/<имя презентации>/.
 *
 *   pnpm build:all
 *
 * Каждая презентация собирается со своим --base, чтобы ссылки и ассеты работали
 * при раздаче из подкаталога (GitHub Pages и подобные).
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { listPresentations, presentationEntry, resolveSlidevCli, ROOT } from './shared.mjs'

const presentations = listPresentations()

if (presentations.length === 0) {
  console.error('\n✖ Нет презентаций для сборки.\n')
  process.exit(1)
}

const cli = resolveSlidevCli()

if (!cli) {
  console.error('\n✖ Не найден @slidev/cli. Выполните: pnpm install\n')
  process.exit(1)
}

console.log(`Сборка презентаций: ${presentations.join(', ')}\n`)

const distDir = join(ROOT, 'dist')

for (const deck of presentations) {
  console.log(`\n▸ ${deck}`)

  // Vite не чистит outDir за пределами корня проекта (о чём честно предупреждает
  // на каждой сборке) — без этого удалённый слайд остаётся в раздаче, а ассеты
  // от прошлых сборок копятся
  rmSync(join(distDir, deck), { recursive: true, force: true })

  const result = spawnSync(process.execPath, [
    cli,
    'build',
    presentationEntry(deck),
    '--out',
    join(ROOT, 'dist', deck),
    '--base',
    `/${deck}/`,
  ], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  })

  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')

  if (result.error) {
    console.error(`\n✖ Не удалось запустить сборку «${deck}»: ${result.error.message}\n`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`\n✖ Сборка «${deck}» завершилась с ошибкой.\n`)
    process.exit(result.status ?? 1)
  }

  // Slidev печатает «Unknown layout» красным и завершает сборку успешно —
  // без этой страховки опечатка в лейауте доехала бы до проектора
  if (/Unknown layout/i.test(`${result.stdout}${result.stderr}`)) {
    console.error(`\n✖ В «${deck}» неизвестный лейаут (см. «Unknown layout» выше): Slidev молча подставил default.\n`)
    process.exit(1)
  }
}

// Презентацию могли переименовать или удалить — её сборка осталась бы в раздаче
if (existsSync(distDir)) {
  const known = new Set(presentations)

  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !known.has(entry.name)) {
      rmSync(join(distDir, entry.name), { recursive: true, force: true })
      console.log(`  убрано из раздачи: dist/${entry.name} (такой презентации больше нет)`)
    }
  }
}

console.log(`\n✔ Готово. Результат в dist/\n`)
