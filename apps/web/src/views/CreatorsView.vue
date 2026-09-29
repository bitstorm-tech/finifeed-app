<script setup lang="ts">
import type { FollowedCreator } from "@finifeed/shared";
import { onMounted, ref } from "vue";
import { ApiError } from "../api/client";
import { fetchFollowedCreators, followCreator, resolveYouTubeCreator, unfollowCreator } from "../api/creators";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { showToast } from "../toast";

const creators = ref<FollowedCreator[]>([]);
const listState = ref<"loading" | "ready" | "error">("loading");

const input = ref("");
const busy = ref(false);
const formError = ref<string | null>(null);
const unfollowing = ref<string | null>(null);
const listError = ref<string | null>(null);
const pendingUnfollow = ref<FollowedCreator | null>(null);

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

async function loadCreators() {
  listState.value = "loading";
  try {
    creators.value = await fetchFollowedCreators();
    listState.value = "ready";
  } catch {
    listState.value = "error";
  }
}

/** Resolves the handle or URL and follows it right away; a wrong channel can simply be unfollowed. */
async function follow() {
  if (!input.value.trim() || busy.value) return;
  busy.value = true;
  formError.value = null;
  try {
    const candidate = await resolveYouTubeCreator(input.value);
    if (candidate.subscriptionId) {
      showToast(`You already follow ${candidate.displayName}.`);
    } else {
      const followed = await followCreator(candidate.creatorId);
      creators.value = [...creators.value.filter((c) => c.subscriptionId !== followed.subscriptionId), followed].sort(
        (a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
      );
      showToast(`Now following ${followed.displayName}.`);
    }
    input.value = "";
  } catch (error) {
    formError.value = messageOf(error);
  } finally {
    busy.value = false;
  }
}

async function confirmUnfollow() {
  const creator = pendingUnfollow.value;
  pendingUnfollow.value = null;
  if (!creator) return;
  unfollowing.value = creator.subscriptionId;
  listError.value = null;
  try {
    await unfollowCreator(creator.subscriptionId);
    creators.value = creators.value.filter((c) => c.subscriptionId !== creator.subscriptionId);
  } catch (error) {
    listError.value = messageOf(error);
  } finally {
    unfollowing.value = null;
  }
}

onMounted(loadCreators);
</script>

<template>
  <section>
    <h1 class="page-title">Creators</h1>

    <form class="add-form" @submit.prevent="follow">
      <label for="creator-input" class="add-label">Add a YouTube channel</label>
      <div class="add-row">
        <input
          id="creator-input"
          v-model="input"
          class="text-input"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="@handle or channel URL"
          :disabled="busy"
        />
        <button class="button" type="submit" :disabled="!input.trim() || busy">
          {{ busy ? "Following…" : "Follow" }}
        </button>
      </div>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
    </form>

    <h2 class="section-title">Following</h2>
    <p v-if="listState === 'loading'" class="muted">Loading…</p>
    <p v-else-if="listState === 'error'" class="form-error">
      Couldn't load your creators.
      <button class="link-button" type="button" @click="loadCreators">Try again</button>
    </p>
    <p v-else-if="creators.length === 0" class="muted">
      You don't follow anyone yet. Add a YouTube channel above to get started.
    </p>
    <template v-else>
      <p v-if="listError" class="form-error" role="alert">{{ listError }}</p>
      <ul class="creator-list">
        <li v-for="creator in creators" :key="creator.subscriptionId" class="creator-row">
          <div class="creator">
            <img v-if="creator.avatarUrl" :src="creator.avatarUrl" alt="" class="avatar" referrerpolicy="no-referrer" />
            <div v-else class="avatar avatar-fallback" aria-hidden="true">{{ creator.displayName.charAt(0) }}</div>
            <div class="creator-text">
              <span class="creator-name">{{ creator.displayName }}</span>
              <span class="creator-meta">
                <a
                  v-for="source in creator.sources"
                  :key="source.id"
                  :href="source.canonicalUrl"
                  target="_blank"
                  rel="noopener"
                  class="badge"
                  :title="source.handle ?? source.displayName"
                >
                  YouTube
                </a>
              </span>
            </div>
          </div>
          <button
            class="button button-secondary button-small"
            type="button"
            :disabled="unfollowing === creator.subscriptionId"
            @click="pendingUnfollow = creator"
          >
            Unfollow
          </button>
        </li>
      </ul>
    </template>

    <ConfirmDialog
      :open="pendingUnfollow !== null"
      :title="`Unfollow ${pendingUnfollow?.displayName ?? ''}?`"
      message="Their new videos will no longer show up in your inbox."
      confirm-label="Unfollow"
      destructive
      @confirm="confirmUnfollow"
      @cancel="pendingUnfollow = null"
    />
  </section>
</template>

<style scoped>
.add-form {
  margin: 1rem 0;
}

.add-label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 600;
}

.add-row {
  display: flex;
  gap: 0.5rem;
}

.text-input {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  /* 16px prevents iOS from zooming into the field. */
  font-size: 1rem;
}

.text-input:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.form-error {
  margin: 0.5rem 0 0;
  color: var(--warn);
}

.section-title {
  margin: 1.5rem 0 0.5rem;
  font-size: 1rem;
  color: var(--muted);
  font-weight: 600;
}

.creator-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
}

.creator-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
}

.creator-row + .creator-row {
  border-top: 1px solid var(--border);
}

.creator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.avatar {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
  background: var(--border);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-weight: 700;
}

.creator-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.creator-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--muted);
  font-size: 0.8125rem;
  text-decoration: none;
}

.badge {
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  background: #fbe9e7;
  color: #b3261e;
  font-size: 0.6875rem;
  font-weight: 700;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.muted {
  color: var(--muted);
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
