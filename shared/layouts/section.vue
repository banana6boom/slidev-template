<!--
  Разделитель между смысловыми блоками презентации.

  ---
  layout: section
  step: 2
  ---

  # Компоненты
-->
<script setup lang="ts">
defineProps<{
  /** Порядковый номер блока — помогает слушателю ориентироваться */
  step?: string | number
}>()
</script>

<template>
  <div class="slidev-layout deck-section">
    <span v-if="step" class="deck-section__step">{{ step }}</span>
    <div class="deck-section__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.slidev-layout.deck-section {
  display: flex;
  align-items: center;
  gap: 2rem;
  height: 100%;
  padding: 3.5rem;
}

.deck-section__step {
  font-size: 6rem;
  font-weight: 700;
  line-height: 1;
  opacity: 0.12;
}

.deck-section__content :deep(h1) {
  margin: 0;
  font-size: 2.75rem;
}

.deck-section__content :deep(p) {
  margin-top: 0.5rem;
  opacity: 0.7;
}
</style>
