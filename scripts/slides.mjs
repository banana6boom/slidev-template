#!/usr/bin/env node
/**
 * Запуск Slidev по имени презентации вместо пути к файлу.
 *
 *   pnpm slides 01-intro          →  slidev presentations/01-intro/slides.md --open
 *   pnpm slides 01-intro --remote →  флаги пробрасываются как есть
 *   pnpm build 01-intro            →  slidev build presentations/01-intro/slides.md
 *   pnpm slides:list                  →  список доступных презентаций
 *
 * Почему Node, а не shell: участники работают на разных ОС, а поведение
 * подстановок и кавычек в npm-скриптах различается между cmd, PowerShell и bash.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { ENTRY_FILE, fail, presentationEntry, PRESENTATIONS_DIR, printPresentations, resolveSlidevCli, ROOT } from './shared.mjs'

const COMMANDS = ['dev', 'build', 'export']

const [command, ...rest] = process.argv.slice(2)

if (!command || command === 'list') {
  printPresentations()
  process.exit(0)
}

if (!COMMANDS.includes(command))
  fail(`Неизвестная команда «${command}». Доступны: ${COMMANDS.join(', ')}, list.`)

// Имя презентации — строго первый аргумент; всё после него уходит в Slidev как есть.
// Искать «первый аргумент без дефиса» нельзя: у флагов бывают значения
// (`--port 3031`), и значение приняли бы за имя.
const [name, ...passthrough] = rest

if (!name) {
  console.error('\n✖ Не указана презентация.  Пример:  pnpm slides 01-intro\n')
  printPresentations({ toStderr: true })
  process.exit(1)
}

if (name.startsWith('-'))
  fail(`Имя презентации идёт первым, флаги — после него.  Пример:  pnpm slides 01-intro ${name}`)

const entry = presentationEntry(name)

if (!existsSync(entry)) {
  console.error(`\n✖ Презентация «${name}» не найдена (нет файла ${ENTRY_FILE}).\n`)
  printPresentations({ toStderr: true })
  process.exit(1)
}

/** Каталог браузеров Playwright по правилам самого Playwright. */
function playwrightBrowsersDir() {
  const home = homedir()

  if (process.platform === 'win32')
    return join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'ms-playwright')

  if (process.platform === 'darwin')
    return join(home, 'Library', 'Caches', 'ms-playwright')

  return join(process.env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ms-playwright')
}

function hasPlaywrightBrowser() {
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH

  // «0» — специальное значение «браузеры в node_modules»: не мешаем
  if (custom === '0')
    return true

  const dir = custom ?? playwrightBrowsersDir()
  return existsSync(dir) && readdirSync(dir).some(name => name.startsWith('chromium'))
}

// Экспорту нужен браузер: проверяем заранее, чтобы вместо английского
// стектрейса Playwright дать подсказку с командой установки
if (command === 'export' && !hasPlaywrightBrowser()) {
  fail(
    'Для экспорта в PDF нужен браузер Chromium (ставится один раз):\n'
    + '    sudo npx playwright install-deps chromium   # системные библиотеки\n'
    + '    npx playwright install chromium             # сам браузер\n'
    + '  В devcontainer: флаг INSTALL_PLAYWRIGHT_BROWSER=true в .devcontainer/.env',
  )
}

// В dev открываем браузер по умолчанию; --no-open отключает.
const defaultArgs = command === 'dev' && !passthrough.includes('--no-open')
  ? ['--open']
  : []

// Флаг может прийти двумя формами: «--out путь» и «--out=путь».
// Простой includes() видит только первую, поэтому проверяем обе.
function hasFlag(...names) {
  return passthrough.some(arg => names.some(name => arg === name || arg.startsWith(`${name}=`)))
}

// PDF кладём в папку презентации, а не в корень репозитория; свой --output важнее.
const defaultOutput = command === 'export' && !hasFlag('--output', '-o')
  ? ['--output', `presentations/${name}/export/${name}.pdf`]
  : []

if (defaultOutput.length > 0)
  mkdirSync(join(PRESENTATIONS_DIR, name, 'export'), { recursive: true })

// Первый позиционный аргумент slidev — это команда, кроме dev-режима:
//   slidev <entry>          — dev
//   slidev build <entry>    — сборка
const slidevArgs = command === 'dev'
  ? [entry, ...defaultArgs, ...passthrough]
  : [command, entry, ...defaultOutput, ...passthrough]

const cli = resolveSlidevCli()

if (!cli)
  fail('Не найден @slidev/cli. Выполните: pnpm install')

// Запускаем через текущий Node — не зависим ни от PATH, ни от shell.
const child = spawn(process.execPath, [cli, ...slidevArgs], {
  cwd: ROOT,
  stdio: 'inherit',
})

child.on('error', error => fail(error.message))

// Ctrl+C в терминале доходит до slidev сам (сигнал уходит всей группе),
// а вот «завершить» из панели VS Code или скрипта убивает только обёртку —
// дочерний slidev осиротел бы и продолжил держать порт
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  // Успех подтверждаем явно — вывод Slidev англоязычный и легко пролистывается
  if (code === 0) {
    if (command === 'build' && !hasFlag('--out'))
      console.log(`\n✔ Собрано: presentations/${name}/dist/`)
    if (command === 'export' && defaultOutput.length > 0)
      console.log(`\n✔ PDF: presentations/${name}/export/${name}.pdf`)
  }

  process.exit(code ?? 0)
})
