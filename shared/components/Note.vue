<!--
  Акцентная врезка: важное замечание, подводный камень, совет.

  <Note type="warn" title="Частая ошибка">
  Текст замечания, на которое стоит обратить внимание.
  </Note>

  type: info (по умолчанию) | warn | danger | tip
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'info' | 'warn' | 'danger' | 'tip'
  title?: string
}>(), {
  type: 'info',
})

const ICONS = {
  info: 'i',
  warn: '!',
  danger: '×',
  tip: '★',
} as const

// Union-тип компилируется в обычный `type: String`, поэтому опечатка в type
// не даёт ни ошибки сборки, ни предупреждения: врезка просто теряет иконку
// и цвет. Подстраховываемся в рантайме и говорим об этом вслух.
const kind = computed(() => {
  if (props.type in ICONS)
    return props.type

  console.warn(
    `[Note] Неизвестный type «${props.type}». Допустимые: ${Object.keys(ICONS).join(', ')}. Использую «info»`,
  )
  return 'info' as const
})
</script>

<template>
  <div class="deck-note" :class="`deck-note--${kind}`">
    <span class="deck-note__icon">{{ ICONS[kind] }}</span>
    <div class="deck-note__body">
      <div v-if="title" class="deck-note__title">
        {{ title }}
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.deck-note {
  display: flex;
  gap: 0.7rem;
  margin: 0.75rem 0;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  background: rgb(128 128 128 / 8%);
  border-left: 3px solid var(--deck-note-color);
  font-size: 0.95rem;
}

.deck-note--info {
  --deck-note-color: #3b82f6;
}

.deck-note--warn {
  --deck-note-color: #f59e0b;
}

.deck-note--danger {
  --deck-note-color: #ef4444;
}

.deck-note--tip {
  --deck-note-color: #16a34a;
}

.deck-note__icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  background: var(--deck-note-color);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
}

.deck-note__title {
  margin-bottom: 0.2rem;
  font-weight: 600;
}

.deck-note__body :deep(p) {
  margin: 0;
}

.deck-note__body :deep(p + p) {
  margin-top: 0.4rem;
}
</style>
