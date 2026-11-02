<script setup lang="ts">
const props = defineProps<{
  page: number;
  hasNext: boolean;
  loading?: boolean;
  totalPages?: number;
  label?: string;
}>();

const emit = defineEmits<{
  change: [page: number];
}>();
const { t } = useLocale();
const root = ref<HTMLElement | null>(null);

function change(target: number): void {
  emit("change", target);
}

// Keep keyboard focus on the pager, but bring the new page's list into view.
watch(() => props.page, async () => {
  await nextTick();
  root.value?.closest("[data-paginated]")?.scrollIntoView({ block: "start", behavior: "instant" });
});
</script>

<template>
  <nav ref="root" class="pagination" :aria-label="label || t('pagination.label')" :aria-busy="loading">
    <p class="pagination-status" role="status" aria-live="polite" aria-atomic="true">
      {{ totalPages ? t('pagination.page_of', { page, total: totalPages }) : t('pagination.page', { page }) }}
    </p>
    <div class="pagination-actions">
      <button type="button" :disabled="loading || page <= 1" @click="change(page - 1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m14 7-5 5 5 5" /></svg>
        {{ t('pagination.previous') }}
      </button>
      <button type="button" :disabled="loading || !hasNext" @click="change(page + 1)">
        {{ t('pagination.next') }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m10 7 5 5-5 5" /></svg>
      </button>
    </div>
  </nav>
</template>
