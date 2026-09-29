<script setup lang="ts">
import { activeToasts, dismissToast } from "./toast";
</script>

<template>
  <div class="toast-host" aria-live="polite" role="status">
    <TransitionGroup name="toast">
      <button v-for="toast in activeToasts" :key="toast.id" type="button" class="toast" @click="dismissToast(toast.id)">
        {{ toast.message }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 0;
  right: 0;
  /* Sit just above the bottom navigation on phones. */
  bottom: calc(var(--nav-height) + env(safe-area-inset-bottom) + 0.75rem);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  pointer-events: none;
}

.toast {
  max-width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--text);
  color: var(--surface);
  font: inherit;
  font-size: 0.9375rem;
  text-align: left;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  cursor: pointer;
  pointer-events: auto;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (min-width: 48rem) {
  .toast-host {
    bottom: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
