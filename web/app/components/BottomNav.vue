<script setup lang="ts">
const { t } = useLocale();
const route = useRoute();

const items = computed(() => [
  { to: "/", label: t("nav.follows"), icon: "📋" },
  { to: "/online", label: t("nav.online"), icon: "🟢" },
  { to: "/add", label: t("nav.add"), icon: "➕" },
  { to: "/settings", label: t("nav.settings"), icon: "⚙️" },
  { to: "/about", label: t("nav.about"), icon: "ℹ️" },
]);

function isActive(path: string): boolean {
  if (path === "/") return route.path === "/" || route.path.startsWith("/follow/");
  return route.path.startsWith(path);
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-20 border-t tg-bar safe-bottom"
    style="border-color: var(--tg-border)"
    :aria-label="t('nav.follows')"
  >
    <ul class="mx-auto flex max-w-2xl items-stretch justify-between px-2">
      <li v-for="item in items" :key="item.to" class="flex-1">
        <NuxtLink
          :to="item.to"
          class="flex flex-col items-center gap-1 rounded-lg px-1 pt-2 text-[11px] font-medium transition-colors"
          :class="isActive(item.to) ? 'tg-link' : 'tg-hint'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <span class="text-lg leading-none" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
