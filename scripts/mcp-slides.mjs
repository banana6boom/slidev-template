#!/usr/bin/env node
/**
 * Переключение MCP-сервера Slidev на другую презентацию.
 *
 *   pnpm mcp 02-components
 *
 * Команда `slidev mcp` требует конкретный файл слайдов и не умеет определять
 * его сама, поэтому презентация задана в .mcp.json жёстко. Скрипт меняет её одной
 * командой вместо ручной правки файла.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { ENTRY_FILE, fail, listPresentations, printPresentations, ROOT } from './shared.mjs'

const MCP_FILE = join(ROOT, '.mcp.json')
const [name, ...extra] = process.argv.slice(2)

if (!name) {
  console.error('\n✖ Не указана презентация.  Пример:  pnpm mcp 02-components\n')
  printPresentations({ toStderr: true })
  process.exit(1)
}

if (extra.length > 0)
  fail(`Лишние аргументы: ${extra.join(' ')}. Нужна ровно одна презентация`)

// Сверяем со списком презентаций, а не через existsSync(path.join(...)):
// join схлопнул бы «01-intro/» до валидного пути, а в .mcp.json ушло бы
// сырое имя — с двойным слэшем внутри
if (!listPresentations().includes(name)) {
  console.error(`\n✖ Презентация «${name}» не найдена (нет файла ${ENTRY_FILE}).\n`)
  printPresentations({ toStderr: true })
  process.exit(1)
}

const config = JSON.parse(readFileSync(MCP_FILE, 'utf8'))
const args = config.mcpServers?.slidev?.args ?? []
const at = args.findIndex(arg => arg.startsWith('presentations/'))

if (at === -1)
  fail('Не нашёл путь презентации в .mcp.json — структура файла изменилась?')

const previous = args[at]
args[at] = `presentations/${name}/${ENTRY_FILE}`
writeFileSync(MCP_FILE, `${JSON.stringify(config, null, 2)}\n`)

console.log(`✔ MCP-сервер Slidev переключён: ${previous} → ${args[at]}`)
console.log('  Перезапустите Claude Code, чтобы изменение вступило в силу.')
