<!--
  Двухколоночный блок: код слева, пояснение справа.

  <CodeExplain>

  ```ts
  const greet = (name: string) => `Привет, ${name}`
  ```

  <template #explain>

  Пояснение к коду слева.

  </template>

  </CodeExplain>

  Соотношение колонок настраивается: <CodeExplain ratio="3fr 2fr">

  ВАЖНО: именно <template #explain>, а не сокращение ::explain::.
  Сахар с двоеточиями Slidev применяет только к слотам ЛЕЙАУТА
  (layout: во frontmatter), внутри слайда он не обрабатывается —
  слайд не соберётся с ошибкой «Element is missing end tag».

  Пустые строки вокруг содержимого обязательны: без них markdown
  внутри template не отрендерится.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Пропорции колонок в терминах grid-template-columns */
  ratio?: string
}>(), {
  ratio: '1fr 1fr',
})
</script>

<template>
  <div class="deck-code-explain" :style="{ gridTemplateColumns: ratio }">
    <div class="deck-code-explain__code">
      <slot />
    </div>
    <div class="deck-code-explain__text">
      <slot name="explain" />
    </div>
  </div>
</template>

<style scoped>
.deck-code-explain {
  display: grid;
  gap: 1.25rem;
  align-items: start;
  margin: 0.5rem 0;
}

/* Код в колонке не должен выдавливать сетку — переполнение скроллится */
.deck-code-explain__code {
  min-width: 0;
}

.deck-code-explain__code :deep(pre) {
  margin: 0;
  overflow-x: auto;
}

.deck-code-explain__text {
  min-width: 0;
  font-size: 0.95rem;
}

.deck-code-explain__text :deep(p:first-child) {
  margin-top: 0;
}
</style>
