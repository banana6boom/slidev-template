<!--
  Критерии приёмки задания или итоги блока.

  <Checklist :items="[
    'Компонент создан через CLI',
    'Данные приходят через @Input',
  ]" />

  Либо со слотом, если нужен markdown внутри пунктов.
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Пункты списка */
  items?: string[]
  /** Заголовок блока */
  title?: string
}>()

// Забытое двоеточие («items=» вместо «:items=») передаёт строку вместо массива,
// а v-for по строке идёт по символам: вместо пункта получаем «✓ П», «✓ у», «✓ н».
// Сборка при этом зелёная, поэтому нормализуем и предупреждаем.
const list = computed(() => {
  const { items } = props

  if (items === undefined || Array.isArray(items))
    return items

  console.warn(
    `[Checklist] items получил ${typeof items} вместо массива. Возможно, пропущено двоеточие: пишите :items="[…]"`,
  )
  return [String(items)]
})
</script>

<template>
  <div class="deck-checklist">
    <div v-if="title" class="deck-checklist__title">
      {{ title }}
    </div>

    <ul v-if="list?.length" class="deck-checklist__list">
      <li v-for="item in list" :key="item" class="deck-checklist__item">
        <span class="deck-checklist__mark">✓</span>
        <span>{{ item }}</span>
      </li>
    </ul>

    <div v-else class="deck-checklist__slot">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.deck-checklist {
  margin: 0.75rem 0;
}

.deck-checklist__title {
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.deck-checklist__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.deck-checklist__item {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.2rem 0;
}

.deck-checklist__mark {
  flex-shrink: 0;
  color: #16a34a;
  font-weight: 700;
}

/* Пункты, пришедшие из markdown-слота */
.deck-checklist__slot :deep(ul) {
  margin: 0;
  padding-left: 1.1rem;
}
</style>
