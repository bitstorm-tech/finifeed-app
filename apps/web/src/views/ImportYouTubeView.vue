<script setup lang="ts">
import { TAKEOUT_CSV_MAX_LENGTH, TAKEOUT_IMPORT_BATCH_SIZE, type TakeoutChannel } from "@finifeed/shared";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError } from "../api/client";
import { importTakeoutChannels, previewTakeout } from "../api/youtube-takeout";
import { showToast } from "../toast";

const router = useRouter();

const step = ref<"pick" | "reading" | "select" | "importing">("pick");
const error = ref<string | null>(null);
const channels = ref<TakeoutChannel[]>([]);
const selected = ref(new Set<string>());
const filter = ref("");
const progress = ref({ done: 0, total: 0 });
/** Kept to refresh the "already following" marks if an import fails halfway. */
let csv = "";

const foundText = computed(() => {
  const found = `${channels.value.length} ${channels.value.length === 1 ? "subscription" : "subscriptions"} found`;
  const following = channels.value.filter((c) => c.subscriptionId).length;
  return following > 0 ? `${found}, ${following} already in Finifeed.` : `${found}.`;
});
const importLabel = computed(() => {
  if (step.value === "importing") {
    const { done, total } = progress.value;
    return total > TAKEOUT_IMPORT_BATCH_SIZE ? `Following… ${done} / ${total}` : "Following…";
  }
  const count = selected.value.size;
  return count === 0 ? "Follow" : `Follow ${count} ${count === 1 ? "creator" : "creators"}`;
});
const visible = computed(() => {
  const query = filter.value.trim().toLocaleLowerCase();
  return query ? channels.value.filter((c) => c.title.toLocaleLowerCase().includes(query)) : channels.value;
});
const visibleSelectable = computed(() => visible.value.filter((c) => !c.subscriptionId));
const allVisibleSelected = computed(
  () => visibleSelectable.value.length > 0 && visibleSelectable.value.every((c) => selected.value.has(c.channelId)),
);

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

async function onFileChosen(event: Event) {
  const fileInput = event.target as HTMLInputElement;
  const file = fileInput.files?.[0];
  // Allows choosing the same file again after an error.
  fileInput.value = "";
  if (!file) return;

  error.value = null;
  if (file.size > TAKEOUT_CSV_MAX_LENGTH) {
    error.value = "This file is too large for a subscriptions export. Please choose subscriptions.csv.";
    return;
  }
  step.value = "reading";
  try {
    csv = await file.text();
    channels.value = await previewTakeout(csv);
    selected.value = new Set();
    filter.value = "";
    step.value = "select";
  } catch (e) {
    error.value = messageOf(e);
    step.value = "pick";
  }
}

function toggle(channelId: string) {
  if (!selected.value.delete(channelId)) selected.value.add(channelId);
}

function toggleAllVisible() {
  const select = !allVisibleSelected.value;
  for (const channel of visibleSelectable.value) {
    if (select) selected.value.add(channel.channelId);
    else selected.value.delete(channel.channelId);
  }
}

function chooseAnotherFile() {
  error.value = null;
  step.value = "pick";
}

function summary(followed: number, notFound: number): string {
  const parts = [followed === 1 ? "Now following 1 creator." : `Now following ${followed} creators.`];
  if (notFound > 0) parts.push(notFound === 1 ? "1 channel no longer exists." : `${notFound} channels no longer exist.`);
  return parts.join(" ");
}

/** Follows the selection in batches, so large selections show progress instead of one long request. */
async function importSelected() {
  const channelIds = channels.value.filter((c) => !c.subscriptionId && selected.value.has(c.channelId)).map((c) => c.channelId);
  if (channelIds.length === 0) return;

  error.value = null;
  progress.value = { done: 0, total: channelIds.length };
  step.value = "importing";
  let followed = 0;
  let notFound = 0;
  try {
    for (let i = 0; i < channelIds.length; i += TAKEOUT_IMPORT_BATCH_SIZE) {
      const result = await importTakeoutChannels(channelIds.slice(i, i + TAKEOUT_IMPORT_BATCH_SIZE));
      followed += result.followed.length;
      notFound += result.notFoundChannelIds.length;
      progress.value.done = Math.min(i + TAKEOUT_IMPORT_BATCH_SIZE, channelIds.length);
    }
  } catch (e) {
    error.value = followed > 0 ? `${messageOf(e)} ${summary(followed, notFound)}` : messageOf(e);
    channels.value = await previewTakeout(csv).catch(() => channels.value);
    for (const channel of channels.value) if (channel.subscriptionId) selected.value.delete(channel.channelId);
    step.value = "select";
    return;
  }
  showToast(summary(followed, notFound));
  await router.push("/creators");
}
</script>

<template>
  <section>
    <RouterLink to="/creators" class="back-link">← Creators</RouterLink>
    <h1 class="page-title">Import from YouTube</h1>

    <template v-if="step === 'pick' || step === 'reading'">
      <p class="intro">
        Pick creators from your YouTube subscriptions. Nothing is followed until you choose, and your YouTube
        account stays untouched.
      </p>
      <ol class="instructions">
        <li>
          Open <a href="https://takeout.google.com/" target="_blank" rel="noopener">Google Takeout</a>, click
          <em>Deselect all</em> and select only <em>YouTube and YouTube Music</em>.
        </li>
        <li>Under <em>All YouTube data included</em>, keep only <em>subscriptions</em>. Create the export.</li>
        <li>
          Download and unzip it, then choose <code>subscriptions.csv</code> from the <code>subscriptions</code> folder.
          Folder and file names may be in your language.
        </li>
      </ol>
      <label class="button file-button" :class="{ disabled: step === 'reading' }">
        <input
          type="file"
          accept=".csv,text/csv"
          class="visually-hidden"
          :disabled="step === 'reading'"
          @change="onFileChosen"
        />
        {{ step === "reading" ? "Reading…" : "Choose CSV file" }}
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </template>

    <template v-else>
      <p class="muted">{{ foundText }}</p>

      <div class="toolbar">
        <input
          v-if="channels.length > 8"
          v-model="filter"
          class="text-input"
          type="search"
          placeholder="Filter by name"
          aria-label="Filter by name"
        />
        <button
          class="button button-secondary button-small"
          type="button"
          :disabled="step === 'importing' || visibleSelectable.length === 0"
          @click="toggleAllVisible"
        >
          {{ allVisibleSelected ? "Deselect all" : "Select all" }}
        </button>
      </div>

      <p v-if="visible.length === 0" class="muted">No subscriptions match “{{ filter }}”.</p>
      <ul v-else class="channel-list">
        <li v-for="channel in visible" :key="channel.channelId">
          <label class="channel-row" :class="{ following: channel.subscriptionId }">
            <input
              type="checkbox"
              class="checkbox"
              :checked="channel.subscriptionId !== null || selected.has(channel.channelId)"
              :disabled="channel.subscriptionId !== null || step === 'importing'"
              @change="toggle(channel.channelId)"
            />
            <span class="channel-title">{{ channel.title }}</span>
            <span v-if="channel.subscriptionId" class="channel-state">Following</span>
          </label>
        </li>
      </ul>

      <div class="actions">
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="action-row">
          <button
            class="button button-secondary"
            type="button"
            :disabled="step === 'importing'"
            @click="chooseAnotherFile"
          >
            Other file
          </button>
          <button
            class="button"
            type="button"
            :disabled="selected.size === 0 || step === 'importing'"
            @click="importSelected"
          >
            {{ importLabel }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.back-link {
  display: inline-block;
  margin-bottom: 0.5rem;
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: none;
}

.intro {
  margin: 0 0 1rem;
  line-height: 1.45;
}

.instructions {
  margin: 0 0 1.25rem;
  padding-left: 1.25rem;
  line-height: 1.5;
}

.instructions li + li {
  margin-top: 0.375rem;
}

.instructions a {
  color: var(--accent);
}

.instructions code {
  font-size: 0.875em;
}

.file-button {
  display: inline-block;
}

.file-button.disabled {
  opacity: 0.55;
  cursor: default;
}

.file-button:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin: 1rem 0 0.75rem;
}

.channel-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
}

.channel-list li + li {
  border-top: 1px solid var(--border);
}

.channel-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}

.channel-row.following {
  color: var(--muted);
  cursor: default;
}

.checkbox {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  accent-color: var(--accent);
}

.channel-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-state {
  flex: none;
  font-size: 0.8125rem;
}

/* Keeps the main action reachable in long lists, above the mobile navigation. */
.actions {
  position: sticky;
  bottom: calc(var(--nav-height) + env(safe-area-inset-bottom));
  padding: 0.75rem 0;
  background: var(--bg);
}

.actions .form-error {
  margin: 0 0 0.5rem;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (min-width: 48rem) {
  .actions {
    bottom: 0;
  }
}
</style>
