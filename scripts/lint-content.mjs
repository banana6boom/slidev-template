#!/usr/bin/env node
/**
 * Проверка слайдов на грабли, которые не ловит сборка.
 *
 *   pnpm lint:content
 *
 * Все правила ниже проверены экспериментально: часть дефектов проходит сборку
 * молча и всплывает уже на проекторе. Например, забытый `addons` — Vue просто
 * не резолвит компонент, и на слайде оказывается пустое место.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import process from 'node:process'

import { ENTRY_FILE, listPresentations, PRESENTATIONS_DIR, ROOT } from './shared.mjs'

const SHARED_DIR = join(ROOT, 'shared')
const ADDON_PATH = '../shared'

const problems = []

function report(file, line, rule, message, hint) {
  problems.push({ file: relative(ROOT, file), line, rule, message, hint })
}

/**
 * Имена общих компонентов и лейаутов — из файловой системы, а не списком
 * в коде: иначе появится второе место с правилами, которое разъедется.
 */
function sharedComponentNames() {
  const names = []

  for (const sub of ['components', 'layouts']) {
    const dir = join(SHARED_DIR, sub)
    if (!existsSync(dir))
      continue

    for (const file of readdirSync(dir)) {
      if (file.endsWith('.vue'))
        names.push({ name: basename(file, '.vue'), kind: sub })
    }
  }

  return names
}

// ─── Известные имена лейаутов и компонентов ──────────────────────────────────
//
// Встроенные имена берём из установленного Slidev, а не дублируем списком.
// Без node_modules эти правила тихо выключаются (vueBasenames вернёт null) —
// остальному линтеру установка по-прежнему не нужна.

const CLIENT_DIR = join(ROOT, 'node_modules', '@slidev', 'client')
const THEME_DIR = join(ROOT, 'node_modules', '@slidev', 'theme-default')

// Компоненты самого Vue — не файлы, поэтому единственный список в коде
const VUE_BUILTINS = ['Transition', 'TransitionGroup', 'Teleport', 'Suspense', 'KeepAlive']

function vueBasenames(dir, upperOnly = false) {
  if (!existsSync(dir))
    return null

  return readdirSync(dir)
    .filter(file => /\.(?:vue|ts)$/.test(file) && !file.endsWith('.test.ts'))
    .map(file => basename(file, extname(file)))
    .filter(name => !upperOnly || /^[A-Z]/.test(name))
}

function knownLayouts() {
  const builtin = vueBasenames(join(CLIENT_DIR, 'layouts'))
  if (!builtin)
    return null

  const theme = vueBasenames(join(THEME_DIR, 'layouts')) ?? []
  const shared = sharedComponentNames()
    .filter(entry => entry.kind === 'layouts')
    .map(entry => entry.name)

  return new Set([...builtin, ...theme, ...shared])
}

const KNOWN_LAYOUTS = knownLayouts()

const componentCache = new Map()

/** Компоненты, доступные в слайдах презентации: встроенные + тема + shared + локальные. */
function knownComponents(deck) {
  if (componentCache.has(deck))
    return componentCache.get(deck)

  const builtin = vueBasenames(join(CLIENT_DIR, 'builtin'), true)
  const known = builtin === null
    ? null
    : new Set([
        ...builtin,
        ...vueBasenames(join(THEME_DIR, 'components'), true) ?? [],
        ...vueBasenames(join(PRESENTATIONS_DIR, deck, 'components'), true) ?? [],
        ...sharedComponentNames()
          .filter(entry => entry.kind === 'components')
          .map(entry => entry.name),
        ...VUE_BUILTINS,
      ])

  componentCache.set(deck, known)
  return known
}

// Подсказка «возможно, имелся в виду…» для опечаток в именах
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2)
    return 3 // дальше порога — точное значение не нужно

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = current
  }

  return prev[b.length]
}

function closest(name, candidates) {
  let best = null
  let bestDistance = 3

  for (const candidate of candidates) {
    const distance = levenshtein(name.toLowerCase(), candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best
}

// yaml есть в дереве зависимостей Slidev; без node_modules правило
// broken-frontmatter тихо выключается
let parseYaml = null
try {
  const yaml = await import('yaml')
  parseYaml = yaml.parse
}
catch {}

/**
 * Индексы строк, начало которых лежит внутри HTML-комментария.
 * Считается по исходному тексту — для правил, которым комментарии важны.
 */
function commentedLineStarts(raw) {
  const offsets = [0]
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '\n')
      offsets.push(i + 1)
  }

  const starts = new Set()
  for (const match of raw.matchAll(/<!--[\s\S]*?-->/g)) {
    offsets.forEach((offset, line) => {
      if (offset > match.index && offset < match.index + match[0].length)
        starts.add(line)
    })
  }

  return starts
}

/**
 * Вырезает HTML-комментарии, сохраняя нумерацию строк.
 *
 * В них живут примеры разметки (генератор презентации кладёт закомментированный
 * образец с «src:») и заметки презентатора — рабочей разметкой это не является.
 */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, match =>
    match.replace(/[^\n]/g, ' '))
}

/**
 * Границы блоков кода — внутри них разметка не анализируется.
 * Возвращает также строку незакрытого блока, если он не закрыт до конца файла.
 */
function codeBlockLines(lines) {
  const inside = new Set()
  let fence = null
  let openedAt = null

  lines.forEach((text, i) => {
    const match = text.match(/^\s*(`{3,}|~{3,})/)

    if (match) {
      if (fence === null) {
        fence = match[1]
        openedAt = i
      }
      else if (match[1].startsWith(fence[0]) && match[1].length >= fence.length) {
        fence = null
        openedAt = null
      }

      inside.add(i)
      return
    }

    if (fence !== null)
      inside.add(i)
  })

  return { inside, unclosedAt: openedAt }
}

/**
 * Строки, попавшие внутрь незакрытого HTML/компонентного блока.
 *
 * Нужно ровно одному правилу — slot-sugar-in-slide: «::name::» на верхнем
 * уровне слайда это легальный слот лейаута, а внутри тега тот же текст валит
 * сборку с «Element is missing end tag». Различить их можно только по глубине.
 *
 * Считаем грубо: парные теги увеличивают и уменьшают глубину, самозакрытые
 * и void-теги игнорируются. Точность разбора HTML здесь не нужна — важно
 * лишь «внутри тега или нет».
 */
function htmlNestedLines(lines, codeLines) {
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source'])
  const inside = new Set()
  let depth = 0

  lines.forEach((text, i) => {
    if (codeLines.has(i))
      return

    // Каждый слайд Slidev компилирует как отдельный SFC, поэтому незакрытый тег
    // физически не переходит через границу слайда. Без сброса одна незакрытая
    // пара где-то в начале файла пометила бы «внутри тега» весь остаток
    if (text.trim() === '---') {
      depth = 0
      return
    }

    if (depth > 0)
      inside.add(i)

    for (const tag of text.matchAll(/<(\/?)([a-z][\w-]*)([\s/][^>]*)?>/gi)) {
      const [, closing, name, rest] = tag
      if (rest?.endsWith('/') || VOID.has(name.toLowerCase()))
        continue

      if (closing)
        depth = Math.max(0, depth - 1)
      else
        depth += 1
    }
  })

  return inside
}

/**
 * Диапазоны frontmatter-блоков: [начало, конец] по индексам строк.
 *
 * В Slidev «---» играет две роли: граница слайда и обрамление frontmatter.
 * Попарно делить все «---» нельзя — закрывающая граница слайда спаривается
 * со следующей, и внутрь мнимого диапазона попадает тело слайда (например,
 * разделитель markdown-таблицы «| --- |»).
 *
 * Различаем по семантике Slidev: frontmatter начинается СРАЗУ после «---»,
 * без пустой строки, и первая же строка — ключ верхнего уровня («layout:»,
 * «title:»). Если после разделителя пусто или идёт markdown — это была
 * граница слайда.
 *
 * Судить «похоже на YAML» построчно нельзя: заголовок «# Декораторы» неотличим
 * от YAML-комментария, а буллет «- @Input() …» — от элемента списка. Тогда
 * обычный слайд принимается за frontmatter: его содержимое исключается из всех
 * остальных правил (дефекты проходят молча), а разбор YAML падает на «@»
 * и блокирует коммит на валидном контенте.
 */
function frontmatterRanges(lines, codeLines) {
  const isSeparator = i => !codeLines.has(i) && lines[i].trim() === '---'
  // Ключ верхнего уровня: без отступа, до двоеточия — только имя ключа
  const isTopLevelKey = text => /^[\w.$-]+\s*:(?:\s|$)/.test(text)
  const isComment = text => /^#(?:\s|$)/.test(text)

  const ranges = []

  for (let i = 0; i < lines.length; i += 1) {
    if (!isSeparator(i))
      continue

    // Frontmatter идёт сразу за «---», без пустой строки. Заголовок «# …»
    // от YAML-комментария по одной строке не отличить, поэтому пропускаем
    // такие строки и требуем ключ верхнего уровня до закрывающего «---»:
    // у слайда «# Заголовок + список» его не будет.
    let head = i + 1
    while (head < lines.length && isComment(lines[head]))
      head += 1

    if (head >= lines.length || !isTopLevelKey(lines[head]))
      continue

    for (let j = i + 1; j < lines.length; j += 1) {
      if (isSeparator(j)) {
        ranges.push([i, j])
        i = j
        break
      }
    }
  }

  return ranges
}

// ─── Правила уровня презентации ───────────────────────────────────────────────────

function checkPresentation(deck) {
  const entryPath = join(PRESENTATIONS_DIR, deck, ENTRY_FILE)
  // Комментарии вырезаем: в них лежат примеры разметки, а не рабочие ссылки
  const entry = stripHtmlComments(readFileSync(entryPath, 'utf8'))
  const entryLines = entry.split('\n')
  const { inside: entryCode } = codeBlockLines(entryLines)
  const headmatter = frontmatterRanges(entryLines, entryCode)[0]

  // Подключён ли общий аддон и с каким путём
  const headText = headmatter
    ? entryLines.slice(headmatter[0], headmatter[1] + 1).join('\n')
    : ''
  const hasAddon = /^\s*-\s*\.\.\/shared\s*$/m.test(headText)

  // Неверный путь к аддону: лишний уровень «съедается» резолвером Slidev
  const wrongPath = entryLines.findIndex(text => /^\s*-\s*\.\.\/\.\.\/shared\s*$/.test(text))
  if (wrongPath !== -1) {
    report(
      entryPath,
      wrongPath + 1,
      'addon-path',
      'Неверный путь к общим блокам: «../../shared»',
      `Правильно «${ADDON_PATH}»: путь считается от папки presentations/, а не от файла`,
    )
  }

  // download: true тянет за собой генерацию PDF при обычной сборке
  const download = entryLines.findIndex((text, i) =>
    headmatter && i > headmatter[0] && i < headmatter[1] && /^\s*download:\s*true\s*$/.test(text))
  if (download !== -1) {
    report(
      entryPath,
      download + 1,
      'download-flag',
      '«download: true» в headmatter',
      'Обычная сборка потребует браузер Playwright у каждого участника. PDF собирайте через pnpm export',
    )
  }

  // Собираем все файлы презентации: entry + секции, подключённые через src:
  // (.+?), а не (\S+): путь секции может содержать пробелы — иначе такая
  // секция считается неподключённой и блокирует коммит как orphan.
  // Хвостовой YAML-комментарий отсекаем, как и в правиле unknown-layout
  const srcRefs = [...entry.matchAll(/^[ \t]*src:[ \t]*([^#\n]+)/gm)]
    .map(match => match[1].trim())
    .filter(Boolean)
  const files = [entryPath]

  for (const ref of srcRefs) {
    const resolved = join(PRESENTATIONS_DIR, deck, ref.replace(/^\.\//, ''))
    if (existsSync(resolved))
      files.push(resolved)
    else
      report(entryPath, 1, 'missing-section', `Секция «${ref}» указана в src:, но файла нет`, 'Проверьте путь или создайте файл')
  }

  // Секции, лежащие в папке, но не подключённые ни одним src:
  const sectionsDir = join(PRESENTATIONS_DIR, deck, 'sections')
  if (existsSync(sectionsDir)) {
    for (const file of readdirSync(sectionsDir)) {
      if (!file.endsWith('.md'))
        continue

      const used = srcRefs.some(ref => ref.endsWith(file))
      if (!used) {
        report(
          join(sectionsDir, file),
          1,
          'orphan-section',
          'Секция не подключена ни к одному src:',
          `Добавьте в ${deck}/${ENTRY_FILE}:  ---\\n  src: ./sections/${file}\\n  ---`,
        )
      }
    }
  }

  for (const file of files)
    checkFile(file, { hasAddon, isEntry: file === entryPath, deck })
}

// ─── Правила уровня файла ────────────────────────────────────────────────────

function checkFile(path, { hasAddon, isEntry, deck }) {
  const raw = readFileSync(path, 'utf8')
  const rawLines = raw.split('\n')
  const lines = stripHtmlComments(raw).split('\n')
  const { inside: codeLines, unclosedAt } = codeBlockLines(lines)
  const ranges = frontmatterRanges(lines, codeLines)
  const htmlNested = htmlNestedLines(lines, codeLines)
  const components = knownComponents(deck)

  // Файл секции должен начинаться сразу с «---»: всё выше первого
  // разделителя Slidev считает отдельным слайдом. Смотрим по исходным
  // строкам, до вырезания комментариев: комментарий-заголовок файла —
  // самый частый способ наступить на эти грабли
  if (!isEntry && ranges.length > 0) {
    const firstFm = ranges[0][0]
    const offending = rawLines.findIndex((text, i) => i < firstFm && text.trim() !== '')

    if (offending !== -1) {
      const isComment = lines[offending].trim() === '' // после вырезания пусто → это был комментарий
      report(
        path,
        offending + 1,
        'content-before-frontmatter',
        isComment
          ? 'Комментарий до первого «---» — это отдельный слайд'
          : 'Контент до первого «---» — это отдельный слайд',
        isComment
          ? 'Slidev превратит комментарий в лишний пустой слайд. Перенесите его ниже, внутрь первого слайда'
          : 'В презентации появится лишний пустой слайд. Сборка при этом проходит успешно',
      )
    }
  }

  // «---» в начале строки внутри HTML-комментария: рантайм Slidev это
  // переживает, но prettier-plugin-slidev (старый парсер) режет файл по такой
  // строке как по границе слайда — и pre-commit переписывает его автоматически
  const commented = commentedLineStarts(raw)
  rawLines.forEach((text, i) => {
    // Строго с нулевой колонки: оба парсера режут файл только по такой строке,
    // и отступ — это ровно тот выход, который советует подсказка ниже
    if (commented.has(i) && !codeLines.has(i) && text.startsWith('---')) {
      report(
        path,
        i + 1,
        'separator-in-comment',
        'Строка внутри HTML-комментария начинается с «---»',
        'prettier разрежет файл по этой строке как по границе слайда. Опишите разделитель словами или добавьте отступ',
      )
    }
  })

  if (unclosedAt !== null) {
    report(
      path,
      unclosedAt + 1,
      'unclosed-fence',
      'Блок кода не закрыт до конца файла',
      'Всё после этой строки станет кодом. Закройте блок той же последовательностью символов',
    )
  }

  // Каждый frontmatter-блок: YAML разбирается, лейаут существует
  for (const [from, to] of ranges) {
    if (parseYaml) {
      try {
        parseYaml(rawLines.slice(from + 1, to).join('\n'))
      }
      catch (error) {
        const inner = error.linePos?.[0]?.line ?? 1
        report(
          path,
          from + 1 + inner,
          'broken-frontmatter',
          `Frontmatter не разбирается как YAML: ${String(error.message).split('\n')[0]}`,
          'Slidev не упадёт — настройки слайда молча потеряются или уедут в текст',
        )
      }
    }

    if (KNOWN_LAYOUTS) {
      for (let i = from + 1; i < to; i += 1) {
        // Хвостовой YAML-комментарий и кавычки — валидный YAML: снимаем их,
        // иначе «layout: enter # потом вернуть» молча пройдёт мимо правила
        const layout = lines[i].match(/^[ \t]*layout:[ \t]*([^#\n]+)/)
        const name = layout && layout[1].trim().replace(/^(['"])(.*)\1$/, '$2')
        if (name && !KNOWN_LAYOUTS.has(name)) {
          const guess = closest(name, KNOWN_LAYOUTS)
          report(
            path,
            i + 1,
            'unknown-layout',
            `Неизвестный лейаут «${name}»`,
            `${guess ? `Возможно, имелся в виду «${guess}». ` : ''}Slidev молча подставит default, сборка останется зелёной`,
          )
        }
      }
    }
  }

  const insideFrontmatter = i => ranges.some(([from, to]) => i > from && i < to)

  lines.forEach((text, i) => {
    const lineNo = i + 1

    // «---» внутри frontmatter обрывает его раньше времени: Slidev режет файл
    // на слайды поиском по тексту, до разбора YAML. Остаток блока становится
    // телом слайда, и заголовок берётся оттуда.
    if (insideFrontmatter(i) && text.includes('---')) {
      report(
        path,
        lineNo,
        'separator-inside-frontmatter',
        'Последовательность «---» внутри frontmatter',
        'Форматирование обрежет значение по «---», а следующие ключи потеряются. Уберите «---» из этой строки — даже из комментария',
      )
    }

    if (codeLines.has(i) || insideFrontmatter(i))
      return

    // На верхнем уровне слайда «::name::» — это слот лейаута, Slidev его
    // компилирует. Внутри тега компонента тот же текст валит сборку
    // с «Element is missing end tag» — вот это и ловим.
    const slot = text.match(/^\s*::(\w[\w-]*)::\s*$/)
    if (slot && htmlNested.has(i)) {
      report(
        path,
        lineNo,
        'slot-sugar-in-slide',
        `«::${slot[1]}::» внутри тега`,
        `Сборка упадёт с «Element is missing end tag». Внутри компонента пишите <template #${slot[1]}> … </template>`,
      )
    }

    // Дальше смотрим текст без инлайн-кода: `код` — не разметка слайда
    const prose = text.replace(/`[^`]*`/g, '')

    // Опечатка в имени компонента не даёт ни ошибки, ни предупреждения:
    // Vue откладывает резолв до рантайма, на слайде остаётся пустое место
    if (components) {
      for (const tag of prose.matchAll(/<([A-Z][A-Za-z0-9]*)(?=[\s/>]|$)/g)) {
        if (!components.has(tag[1])) {
          const guess = closest(tag[1], components)
          report(
            path,
            lineNo,
            'unknown-component',
            `Неизвестный компонент «<${tag[1]}>»`,
            `${guess ? `Возможно, имелся в виду «<${guess}>». ` : ''}Vue оставит на слайде пустое место, сборка останется зелёной`,
          )
        }
      }
    }

    // {{ … }} в тексте — интерполяция Vue: вместо текста будет пустое место
    if (prose.includes('{{')) {
      report(
        path,
        lineNo,
        'interpolation-in-text',
        'Двойные фигурные скобки в тексте — это интерполяция Vue',
        'Чтобы показать скобки как текст, оберните их в инлайн-код',
      )
    }

    // Относительная markdown-ссылка на несуществующий файл — 404 на занятии
    for (const link of prose.matchAll(/(?<!!)\[[^\]]*\]\(\s*(\.\.?\/[^)\s#?]+)/g)) {
      // Пробелы в markdown-ссылке экранируются как %20 — на диске их надо искать
      // в исходном виде, иначе ссылка на существующий файл помечается мёртвой
      let target = link[1]
      try {
        target = decodeURIComponent(target)
      }
      catch {}

      if (!existsSync(join(dirname(path), target))) {
        report(
          path,
          lineNo,
          'missing-link-target',
          `Ссылка на несуществующий файл: «${link[1]}»`,
          'Проверьте путь или добавьте файл — сборка такие ссылки не проверяет',
        )
      }
    }
  })

  // Компоненты из shared/ используются, но аддон не подключён
  if (!hasAddon) {
    const body = lines
      .map((text, i) => (codeLines.has(i) ? '' : text))
      .join('\n')

    for (const { name, kind } of sharedComponentNames()) {
      const usage = kind === 'components'
        ? new RegExp(`<${name}[\\s/>]`)
        : new RegExp(`^\\s*layout:\\s*${name}\\s*$`, 'm')

      if (usage.test(body)) {
        const at = lines.findIndex((text, i) => !codeLines.has(i) && usage.test(text))
        report(
          path,
          at + 1,
          'missing-addon',
          `Используется «${name}», но общие блоки не подключены`,
          `Добавьте в headmatter презентации:  addons:\\n    - ${ADDON_PATH}`,
        )
        break
      }
    }
  }
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

// Без аргумента проверяются все презентации; с аргументом — только названная
const requested = process.argv[2]
const presentations = requested
  ? listPresentations().filter(name => name === requested)
  : listPresentations()

if (requested && presentations.length === 0) {
  console.error(`\n✖ Презентация «${requested}» не найдена.\n`)
  process.exit(1)
}

if (presentations.length === 0) {
  console.log('Презентаций нет — проверять нечего.')
  process.exit(0)
}

for (const deck of presentations)
  checkPresentation(deck)

if (problems.length === 0) {
  console.log(`✔ Слайды в порядке (презентаций: ${presentations.length})`)
  process.exit(0)
}

console.error(`\n✖ Найдено проблем: ${problems.length}\n`)

for (const { file, line, rule, message, hint } of problems) {
  console.error(`${file}:${line}`)
  console.error(`  ${message}  [${rule}]`)
  console.error(`  → ${hint.replace(/\\n/g, '\n    ')}\n`)
}

process.exit(1)
