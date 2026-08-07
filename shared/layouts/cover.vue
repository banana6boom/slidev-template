<!--
  Титульный слайд.

  Задаётся в headmatter slides.md — он же frontmatter первого слайда:

  layout: cover
  title: Название презентации
  subtitle: Подзаголовок
  duration: 90min     ← формат Slidev, на слайде покажется «90 мин»
  badge: Доклад       ← необязательная метка слева от длительности

  Для серии (курс, цикл встреч) удобнее номер: задайте badgeLabel
  в shared/project.json один раз, а в презентации — только number:

  number: 3           → бейдж «Лекция 3» при badgeLabel: «Лекция»
-->
<script setup lang="ts">
import { computed } from 'vue'

// Данные проекта — свойство репозитория, а не отдельной презентации:
// держим в одном месте, чтобы не дублировать в каждом headmatter.
// Путь считается относительно аддона, поэтому работает из любой презентации
import project from '../project.json'

const props = defineProps<{
  /** Готовый текст метки: «Доклад», «Воркшоп» */
  badge?: string
  /** Номер в серии — к нему подставится badgeLabel из project.json */
  number?: string | number
  /** Продолжительность в формате Slidev: «90min», «1h30min» */
  duration?: string
  /** Подзаголовок под названием */
  subtitle?: string
}>()

const badgeText = computed(() => {
  if (props.badge)
    return props.badge

  if (props.number === undefined || props.number === '')
    return ''

  // badgeLabel необязателен: без него покажем просто номер
  return [project.badgeLabel, props.number].filter(Boolean).join(' ')
})

// duration — зарезервированный ключ Slidev: то же значение читает таймер
// презентатора (useTimer). Его парсер понимает только латинские единицы
// («90min»), а на кириллице молча даёт null и ломает индикатор прогресса.
// Поэтому храним в формате Slidev, а по-русски показываем здесь.
const UNITS: Record<string, string> = {
  s: 'с',
  sec: 'с',
  secs: 'с',
  m: 'мин',
  min: 'мин',
  mins: 'мин',
  h: 'ч',
  hr: 'ч',
  hrs: 'ч',
  hour: 'ч',
  hours: 'ч',
}

const durationLabel = computed(() => {
  if (!props.duration)
    return ''

  const parts = [...props.duration.matchAll(/([\d.]+)\s*([a-z]+)/gi)]
  if (parts.length === 0)
    return props.duration

  return parts
    .map(([, value, unit]) => `${value} ${UNITS[unit.toLowerCase()] ?? unit}`)
    .join(' ')
})
</script>

<template>
  <div class="slidev-layout deck-cover">
    <div class="deck-cover__meta">
      <span v-if="badgeText" class="deck-cover__badge">
        {{ badgeText }}
      </span>
      <span v-if="durationLabel" class="deck-cover__duration">
        {{ durationLabel }}
      </span>
    </div>

    <div class="deck-cover__body">
      <slot />
      <p v-if="subtitle" class="deck-cover__subtitle">
        {{ subtitle }}
      </p>
    </div>

    <div class="deck-cover__footer">
      <slot name="footer">
        {{ project.shortTitle }}
      </slot>
    </div>
  </div>
</template>

<style scoped>
/* Селекторы под .slidev-layout, чтобы стили не текли в режим презентатора */
.slidev-layout.deck-cover {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: 3.5rem;
}

.deck-cover__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.deck-cover__badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: var(--deck-accent, #dd0031);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.deck-cover__duration {
  font-size: 0.8rem;
  opacity: 0.6;
}

.deck-cover__body :deep(h1) {
  margin-bottom: 0.5rem;
  font-size: 3rem;
  line-height: 1.1;
}

.deck-cover__subtitle {
  margin-top: 0.75rem;
  font-size: 1.25rem;
  opacity: 0.7;
}

.deck-cover__footer {
  position: absolute;
  bottom: 2rem;
  left: 3.5rem;
  font-size: 0.75rem;
  opacity: 0.45;
}
</style>
