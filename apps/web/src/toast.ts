import { readonly, ref } from "vue";

export type Toast = { id: number; message: string };

const DISPLAY_MS = 3500;

const toasts = ref<Toast[]>([]);
let nextId = 1;

export const activeToasts = readonly(toasts);

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/** Shows a short confirmation that disappears on its own. */
export function showToast(message: string) {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message }];
  window.setTimeout(() => dismissToast(id), DISPLAY_MS);
}
