#!/usr/bin/env node
/**
 * Smoke-тест генератора презентаций.
 *
 *   pnpm test:generator
 *
 * Зачем. Шаблон новой презентации живёт внутри new-slides.mjs строковым литералом.
 * ESLint видит его как строку, а cspell и Prettier проверяют только presentations/**,
 * где сгенерированного ещё нет. Шаблон оказывается в слепой зоне между «код
 * валиден» и «продукт кода валиден»: опечатка или лишний отступ в нём ломают
 * `pnpm check` у того, кто создал новую презентацию, — на пустом каркасе.
 *
 * Тест закрывает эту зону: создаёт презентацию генератором, прогоняет по ней те же
 * проверки, что и `pnpm check`, включая сборку, и удаляет — даже если проверки
 * упали. Сборка здесь обязательна: временная презентация удаляется до шага build:all,
 * так что кроме этого теста шаблон не собрал бы никто.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { ENTRY_FILE, fail, PRESENTATIONS_DIR, resolveBin, resolveSlidevCli, ROOT } from './shared.mjs'

// Служебное имя: две цифры + дефис, как требует генератор. Существующие презентации
// начинаются с 01, поэтому 00 остаётся свободным.
const NAME = '00-smoke-test'
const dir = join(PRESENTATIONS_DIR, NAME)

/** Запускает Node-скрипт в корне репозитория и возвращает код выхода. */
function run(label, file, args) {
  console.log(`\n▸ ${label}`)

  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  })

  if (result.error)
    fail(`Не удалось запустить «${label}»: ${result.error.message}`)

  return result.status ?? 1
}

/**
 * Рекурсивно удаляет папку.
 *
 * Своя реализация вместо rmSync({ recursive: true }): удаляем только то, что
 * сами создали, и падаем на неожиданном содержимом вместо тихой зачистки.
 */
function removeDir(target) {
  if (!existsSync(target))
    return

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const path = join(target, entry.name)

    if (entry.isDirectory())
      removeDir(path)
    else
      unlinkSync(path)
  }

  rmdirSync(target)
}

if (existsSync(dir)) {
  fail(
    `Папка presentations/${NAME} уже существует.\n`
    + '  Это служебное имя для smoke-теста — удалите её и запустите снова.',
  )
}

const cspell = resolveBin('cspell/bin.mjs')
const prettier = resolveBin('prettier/bin/prettier.cjs')
const slidev = resolveSlidevCli()

if (!cspell || !prettier || !slidev)
  fail('Не найдены cspell, prettier или @slidev/cli. Выполните: pnpm install')

console.log(`Проверяем генератор на временной презентации «${NAME}»`)

let failed = null

try {
  // Генератор запускаем как обычно — тем же способом, что и любой участник.
  if (run('Создание презентации', join(ROOT, 'scripts', 'new-slides.mjs'), [NAME]) !== 0)
    failed = 'генератор завершился с ошибкой'

  if (!failed && !existsSync(join(dir, 'slides.md')))
    failed = 'генератор отработал, но slides.md не создан'

  // Проверяем сгенерированное ровно тем же набором, что и `pnpm check`.
  // lint-content — адресно по временной презентации: иначе дефект чужой презентации
  // дал бы ложное «шаблон сломан».
  const checks = [
    ['Разметка слайдов', join(ROOT, 'scripts', 'lint-content.mjs'), [NAME]],
    ['Орфография', cspell, ['--no-progress', `presentations/${NAME}/**/*.md`]],
    ['Форматирование', prettier, ['--check', `presentations/${NAME}/**/*.md`]],
    ['Сборка', slidev, ['build', join('presentations', NAME, ENTRY_FILE)]],
  ]

  for (const [label, file, args] of checks) {
    if (failed)
      break

    if (run(label, file, args) !== 0)
      failed = `${label.toLowerCase()} — проверка не прошла`
  }
}
finally {
  // Убираем за собой в любом случае: иначе упавший тест оставит мусор
  // в presentations/, и следующий запуск споткнётся о существующую папку.
  removeDir(dir)
}

if (failed) {
  console.error(`\n✖ Шаблон новой презентации сломан: ${failed}.`)
  console.error('  Шаблон правится в scripts/new-slides.mjs.')
  console.error('  Новое слово в тексте шаблона добавьте в .cspell/project.txt.\n')
  process.exit(1)
}

console.log('\n✔ Генератор в порядке: новая презентация проходит проверки\n')
