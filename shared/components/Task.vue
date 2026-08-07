<!--
  Выделенный блок с заданием или шагом, который делает аудитория.

  <Task title="Создать компонент" duration="15 мин">

  Опишите здесь, что нужно сделать.

  </Task>

  Метка слева настраивается: label="Демо", label="Шаг 1", label="Разминка".
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Метка слева: «Практика» по умолчанию */
  label?: string
  /** Заголовок задания */
  title?: string
  /** Ориентировочное время выполнения */
  duration?: string
}>(), {
  label: 'Практика',
})
</script>

<template>
  <div class="deck-task">
    <div class="deck-task__head">
      <span class="deck-task__label">{{ label }}</span>
      <span v-if="title" class="deck-task__title">{{ title }}</span>
      <span v-if="duration" class="deck-task__duration">{{ duration }}</span>
    </div>
    <div class="deck-task__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.deck-task {
  margin: 0.75rem 0;
  border-left: 3px solid var(--deck-accent, #dd0031);
  border-radius: 0 6px 6px 0;
  background: rgb(128 128 128 / 8%);
  padding: 0.9rem 1.1rem;
}

.deck-task__head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}

.deck-task__label {
  color: var(--deck-accent, #dd0031);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.deck-task__title {
  font-weight: 600;
}

.deck-task__duration {
  margin-left: auto;
  font-size: 0.75rem;
  opacity: 0.55;
}

.deck-task__body {
  font-size: 0.95rem;
}

.deck-task__body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
