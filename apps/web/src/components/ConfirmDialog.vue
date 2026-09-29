<script setup lang="ts">
import { nextTick, useId, useTemplateRef, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel", destructive: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const cancelButton = useTemplateRef<HTMLButtonElement>("cancelButton");
const titleId = useId();
const messageId = useId();

/** The native <dialog> gives us focus trapping, Escape handling and the top layer for free. */
watch(
  () => props.open,
  async (open) => {
    const el = dialog.value;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Focus the safe action so a stray Enter never confirms a destructive action.
      await nextTick();
      cancelButton.value?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  },
  { flush: "post" },
);

/** Fires for Escape as well as programmatic closes; only report it when the parent still thinks we're open. */
function onClose() {
  if (props.open) emit("cancel");
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit("cancel");
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="message ? messageId : undefined"
    @close="onClose"
    @click="onBackdropClick"
  >
    <div class="dialog-body">
      <h2 :id="titleId" class="dialog-title">{{ title }}</h2>
      <p v-if="message" :id="messageId" class="dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <button ref="cancelButton" class="button button-secondary" type="button" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button
          class="button"
          :class="{ 'button-destructive': destructive }"
          type="button"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(24rem, calc(100vw - 2rem));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1.25rem 3rem rgb(29 29 27 / 0.18);
}

.dialog::backdrop {
  background: rgb(29 29 27 / 0.4);
}

.dialog[open] {
  animation: dialog-in 140ms ease-out;
}

.dialog[open]::backdrop {
  animation: backdrop-in 140ms ease-out;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.98);
  }
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog[open],
  .dialog[open]::backdrop {
    animation: none;
  }
}

.dialog-body {
  padding: 1.25rem;
}

.dialog-title {
  margin: 0;
  font-size: 1.125rem;
}

.dialog-message {
  margin: 0.5rem 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.button-destructive {
  background: var(--warn);
  border-color: var(--warn);
}
</style>
