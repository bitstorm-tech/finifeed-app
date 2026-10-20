import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/inbox" },
    { path: "/inbox", name: "inbox", component: () => import("./views/InboxView.vue") },
    { path: "/later", name: "later", component: () => import("./views/LaterView.vue") },
    {
      path: "/creators",
      // Nested so the Creators navigation link stays active while importing.
      children: [
        { path: "", name: "creators", component: () => import("./views/CreatorsView.vue") },
        { path: "import", name: "creators-import", component: () => import("./views/ImportYouTubeView.vue") },
      ],
    },
    { path: "/settings", name: "settings", component: () => import("./views/SettingsView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/inbox" },
  ],
});
