<script setup lang="ts">
import type { AdminUser } from "~/composables/useAdmin";

const { t } = useLocale();
const { users, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const search = useState("admin-users-search", () => "");
const { items, page, pageSize, hasNext, loading, error, load, reset, invalidate, setPageSize } = useCursorPagination<AdminUser>(
  "admin-users",
  async (request) => {
    await loadSettings();
    return users({ ...request, search: search.value || undefined });
  },
);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  invalidate();
  loading.value = true;
  searchTimer = setTimeout(() => void reset(), 300);
}

function displayName(user: AdminUser): string {
  return user.firstName || user.username || user.id;
}

onMounted(() => void load());
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="flex flex-col gap-4" data-paginated>
    <NuxtLink to="/admin" class="text-sm font-medium tg-link">← {{ t("admin.title") }}</NuxtLink>
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.users.title") }}</h1>

    <input
      v-model="search"
      type="search"
      class="w-full rounded-xl px-4 py-2.5 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
      :placeholder="t('admin.users.search')"
      :aria-label="t('admin.users.search')"
      maxlength="64"
      @input="onSearchInput"
    >

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load()" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li v-for="user in items" :key="user.id">
        <NuxtLink
          :to="`/admin/users/${user.id}`"
          class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
        >
          <span class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-sm font-semibold tg-text">
              {{ displayName(user) }}
              <span v-if="user.username" class="font-normal tg-hint">@{{ user.username }}</span>
            </span>
            <span class="flex flex-wrap items-center gap-1.5 text-xs tg-hint">
              <span>ID {{ user.id }}</span>
              <span>· {{ t("admin.users.follows", { count: user.follows }) }}</span>
              <span>· {{ formatDate(user.created) }}</span>
            </span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <span class="flex flex-col items-end gap-1">
              <span v-if="user.isAdmin" class="rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-link">
                {{ t("admin.users.admin_badge") }}
              </span>
              <span v-if="user.isBotBlocked" class="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                {{ t("admin.users.blocked_badge") }}
              </span>
            </span>
            <span class="text-lg tg-hint" aria-hidden="true">›</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <PaginationControls
      v-if="items.length || page > 1 || loading"
      :page="page" :page-size="pageSize" :has-next="hasNext" :loading="loading"
      @change="load" @page-size="setPageSize"
    />
    <p v-if="error && items.length > 0" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
