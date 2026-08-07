#!/usr/bin/env node
/**
 * Сборка презентаций, затронутых staged-изменениями. Вызывается из pre-commit.
 *
 * CI у репозитория нет, поэтому hook — единственный автоматический рубеж:
 * без этой проверки несобирающаяся презентация спокойно уехала бы в main.
 * Изменение shared/ затрагивает все презентации — тогда собираются все.
 * Вывод сборки показывается только при ошибке, чтобы не шуметь на коммите.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import process from 'node:process'

import { fail, listPresentations, presentationEntry, resolveSlidevCli, ROOT } from './shared.mjs'

const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
  cwd: ROOT,
  encoding: 'utf8',
}).split('\n').filter(Boolean)

const touched = new Set()
for (const file of staged) {
  const match = file.match(/^presentations\/([^/]+)\//)
  if (match)
    touched.add(match[1])
}

const all = listPresentations()
const sharedTouched = staged.some(file => file.startsWith('shared/'))

// Правка shared/ затрагивает все презентации, но собирать их все на каждом коммите
// слишком дорого: при 10–15 презентациях это минуты ожидания. На коммите проверяем
// одну — этого хватает, чтобы поймать несобирающийся общий компонент.
// Полный охват уходит в pre-push (scripts/build-all.mjs).
const targets = sharedTouched
  ? all.slice(0, 1)
  : all.filter(name => touched.has(name))

if (targets.length === 0) {
  console.log('Сборка: staged-изменения не затрагивают презентации — пропускаю')
  process.exit(0)
}

if (sharedTouched)
  console.log(`Правка shared/: на коммите собираем «${targets[0]}», все презентации — при push`)

const cli = resolveSlidevCli()

if (!cli)
  fail('Не найден @slidev/cli. Выполните: pnpm install')

for (const name of targets) {
  console.log(`▸ Сборка ${name}`)

  const result = spawnSync(process.execPath, [cli, 'build', presentationEntry(name)], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
  })

  if (result.error)
    fail(`Не удалось запустить сборку «${name}»: ${result.error.message}`)

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    fail(`Презентация «${name}» не собирается — коммит остановлен`)
  }

  // Slidev печатает «Unknown layout» красным и завершает сборку успешно —
  // та же страховка, что и в build-all: иначе опечатка в лейауте, не пойманная
  // правилом lint-content, доехала бы до проектора через зелёный коммит
  if (/Unknown layout/i.test(`${result.stdout}${result.stderr}`)) {
    process.stdout.write(result.stdout ?? '')
    fail(`В «${name}» неизвестный лейаут (см. «Unknown layout» выше): Slidev молча подставил default`)
  }
}

console.log(`✔ Затронутые презентации собираются (${targets.length})`)
