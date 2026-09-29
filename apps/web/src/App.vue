<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchHealth } from "./api/health";
import ToastHost from "./ToastHost.vue";

const destinations = [
  { to: "/inbox", label: "Inbox" },
  { to: "/later", label: "Later" },
  { to: "/creators", label: "Creators" },
  { to: "/settings", label: "Settings" },
];

type BackendStatus = "checking" | "ok" | "degraded" | "offline";
const backendStatus = ref<BackendStatus>("checking");

onMounted(async () => {
  const health = await fetchHealth();
  backendStatus.value = health?.status ?? "offline";
});
</script>

<template>
  <div class="shell">
    <header class="header">
      <span class="brand">Finifeed</span>
      <span v-if="backendStatus !== 'ok'" class="status" :data-status="backendStatus">
        {{ backendStatus === "checking" ? "Connecting…" : "Server unavailable" }}
      </span>
    </header>

    <main class="content">
      <RouterView />
    </main>

    <nav class="nav" aria-label="Main">
      <RouterLink v-for="d in destinations" :key="d.to" :to="d.to" class="nav-link">
        {{ d.label }}
      </RouterLink>
    </nav>

    <ToastHost />
  </div>
</template>
