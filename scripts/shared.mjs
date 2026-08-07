/**
 * Общее для всех скриптов запуска: где лежат презентации и как найти Slidev.
 *
 * Единственное место, где определено, что считается презентацией.
 * Не дублируйте эту логику в других скриптах — импортируйте отсюда.
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PRESENTATIONS_DIR = join(ROOT, 'presentations')
export const ENTRY_FILE = 'slides.md'

/**
 * Путь к JS-файлу внутри установленного пакета.
 *
 * Резолвим пакет напрямую, а не полагаемся на PATH: переменную дополняют
 * node_modules/.bin только npm и pnpm, а при прямом запуске
 * (`node scripts/slides.mjs`) её там нет. Заодно избавляет от необходимости
 * в shell на Windows, где бинарники — это .cmd-обёртки.
 *
 * @param {string} specifier путь вида '@slidev/cli/bin/slidev.mjs'
 * @returns {string|null} абсолютный путь; null, если пакет не установлен.
 *   Любая другая ошибка резолва завершает процесс с её текстом — совет
 *   «выполните pnpm install» в таком случае только соврал бы.
 */
export function resolveBin(specifier) {
  try {
    // Резолв идёт от этого файла: scripts/ лежит в корне репозитория,
    // и node_modules находится штатным подъёмом вверх по дереву
    return fileURLToPath(import.meta.resolve(specifier))
  }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
      return null

    fail(`Не удалось разрешить «${specifier}»: ${error.message}`)
    return null // недостижимо: fail завершает процесс
  }
}

/**
 * Путь к CLI Slidev.
 *
 * @returns {string|null} путь к slidev.mjs или null, если пакет не установлен
 */
export function resolveSlidevCli() {
  return resolveBin('@slidev/cli/bin/slidev.mjs')
}

/**
 * Список презентаций: подпапки presentations/ со slides.md.
 * Служебные папки (начинаются с `_`) презентациями не считаются.
 *
 * @returns {string[]} имена презентаций по алфавиту
 */
export function listPresentations() {
  if (!existsSync(PRESENTATIONS_DIR))
    return []

  return readdirSync(PRESENTATIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .filter(name => existsSync(join(PRESENTATIONS_DIR, name, ENTRY_FILE)))
    .sort()
}

/** Путь к файлу слайдов презентации. */
export function presentationEntry(name) {
  return join(PRESENTATIONS_DIR, name, ENTRY_FILE)
}

/**
 * Печатает список презентаций с подсказкой по запуску.
 * В ветках ошибок передавайте { toStderr: true }, чтобы сообщение и список
 * не разъезжались по разным потокам при перенаправлении вывода.
 */
export function printPresentations({ toStderr = false } = {}) {
  const print = toStderr ? console.error : console.log
  const presentations = listPresentations()

  if (presentations.length === 0) {
    print('Презентаций пока нет. Создайте первую:  pnpm slides:new 01-intro')
    return
  }

  print('Доступные презентации:\n')
  for (const name of presentations)
    print(`  ${name}`)
  print('\nЗапуск:  pnpm slides <имя>')
}

/** Печатает ошибку и завершает процесс. */
export function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}
