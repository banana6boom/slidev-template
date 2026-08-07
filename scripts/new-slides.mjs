#!/usr/bin/env node
/**
 * Создание каркаса новой презентации.
 *
 *   pnpm slides:new 02-basics
 *   pnpm slides:new 02-basics --title "Основы: типы и структуры"
 *
 * Генерируем кодом, а не копированием папки-шаблона: так каркас всегда
 * соответствует текущим соглашениям, а обязательные вещи (подключение общих
 * блоков через addons) невозможно забыть.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { fail, listPresentations, PRESENTATIONS_DIR, ROOT } from './shared.mjs'

// Данные проекта — в одном файле на весь репозиторий: см. shared/project.json
const project = JSON.parse(readFileSync(join(ROOT, 'shared', 'project.json'), 'utf8'))

// NN-название: две цифры, дефис, латиница/цифры/дефисы
const NAME_PATTERN = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/

const args = process.argv.slice(2)
const titleIndex = args.indexOf('--title')
const customTitle = titleIndex === -1 ? null : args[titleIndex + 1]

// Имя — первый позиционный аргумент, не считая значения --title.
// Исключаем по индексу, а не по значению: заголовок может совпасть с именем.
// titleIndex === -1 проверяем явно, иначе titleIndex + 1 === 0 отбросит
// первый аргумент — то есть само имя.
const titleValueIndex = titleIndex === -1 ? -1 : titleIndex + 1
const name = args.find((arg, i) =>
  !arg.startsWith('-') && i !== titleValueIndex)

if (!name) {
  // Ошибка и подсказка — одним потоком: при перенаправлении вывода иначе
  // видна либо ошибка без примера, либо пример без ошибки
  console.error('\n✖ Не указано имя презентации.\n')
  console.error('Пример:  pnpm slides:new 02-basics')
  console.error('         pnpm slides:new 02-basics --title "Основы: типы и структуры"\n')
  process.exit(1)
}

if (!NAME_PATTERN.test(name)) {
  fail(
    `Имя «${name}» не подходит.\n`
    + '  Формат: NN-название — две цифры, дефис, строчная латиница.\n'
    + '  Например: 02-components, 10-rxjs-basics',
  )
}

const dir = join(PRESENTATIONS_DIR, name)

if (existsSync(dir))
  fail(`Презентация «${name}» уже существует: presentations/${name}`)

// Номер и заголовок выводим из имени, чтобы не оставлять плейсхолдеров
const number = Number.parseInt(name.slice(0, 2), 10)
const title = customTitle ?? name
  .slice(3)
  .replace(/-/g, ' ')
  .replace(/^./, char => char.toUpperCase())

const slides = `---
theme: default

# Общие лейауты, компоненты и стили.
# Путь считается от папки presentations/, а не от этого файла — не меняйте его.
addons:
  - ../shared

# Титульный слайд. Headmatter одновременно служит frontmatter'ом первого
# слайда, поэтому лейаут и его настройки задаются прямо здесь: отдельного
# блока настроек для слайда 1 в Slidev не существует.
layout: cover
number: ${number}
subtitle: Подзаголовок
duration: 90min

title: ${title}
titleTemplate: '${project.titleTemplate}'
author: ${project.author}
colorSchema: auto
aspectRatio: 16/9
canvasWidth: 980

highlighter: shiki
lineNumbers: true

transition: slide-left
drawings:
  persist: false

# download: true не включаем — иначе сборка требует браузер Playwright.
# PDF собирается отдельно: pnpm export ${name}
exportFilename: ${name}
---

# ${title}

<!--
Заметки для презентатора: видны только вам — откройте /presenter
или нажмите кнопку в панели внизу слайда.
-->

---

src: ./sections/01-intro.md
---

<!--
Добавляйте секции по мере наполнения презентации — блоком вида
«тройное тире, строка src, тройное тире» после предыдущей секции.
Пример есть выше, над этим комментарием.

Держите в секции 3–10 слайдов и один смысловой блок: так проще ревьюить
и меньше конфликтов в git при совместной работе.
-->
`

// Файл секции начинается сразу с «---»: всё, что выше первого разделителя,
// Slidev считает отдельным слайдом.
const section = `---
# О чём поговорим

<v-clicks>

- Первый пункт
- Второй пункт
- Третий пункт

</v-clicks>
---

# Что вы будете уметь

<Checklist
  title="К концу презентации"
  :items="[
    'Первый навык',
    'Второй навык',
  ]"
/>

<!--
Справочник по общим блокам (Task, Checklist, CodeExplain, Note) — в AGENTS.md.
-->
`

mkdirSync(join(dir, 'sections'), { recursive: true })
writeFileSync(join(dir, 'slides.md'), slides, 'utf8')
writeFileSync(join(dir, 'sections', '01-intro.md'), section, 'utf8')

console.log(`
✔ Презентация «${title}» создана

  presentations/${name}/slides.md
  presentations/${name}/sections/01-intro.md

Запуск:  pnpm slides ${name}
`)

const others = listPresentations().filter(other => other !== name)
if (others.length > 0)
  console.log(`Другие презентации: ${others.join(', ')}\n`)
