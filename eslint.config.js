import antfu from '@antfu/eslint-config'

// @antfu/eslint-config включает правила форматирования (ESLint Stylistic)
// с автофиксом, поэтому отдельный Prettier для кода не нужен. Дефолты конфига
// уже совпадают со стилем проекта: без точек с запятой, одинарные кавычки,
// 2 пробела, висячие запятые.
export default antfu({
  vue: true,
  typescript: true,

  // Слайды форматирует Prettier с prettier-plugin-slidev — у него свой
  // парсер, понимающий разделители и frontmatter Slidev.
  markdown: false,

  ignores: [
    'dist',
    'presentations/**/*.md',
    // Копия официального skill Slidev — обновляется целиком из upstream
    '.claude/skills/**',
  ],
})
