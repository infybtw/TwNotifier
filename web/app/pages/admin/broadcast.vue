<script setup lang="ts">
import { useApiError } from "~/composables/useApi";

const { t } = useLocale();
const localizeError = useApiError();
const { broadcast } = useAdmin();
useAdminGuard();

const text = ref("");
const photo = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const confirming = ref(false);
const sending = ref(false);
const error = ref<string | null>(null);
const result = ref<{ sent: number; failed: number } | null>(null);

const canSend = computed(() => Boolean(text.value.trim() || photo.value));

function onPhotoChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photo.value = file;
  photoPreview.value = file ? URL.createObjectURL(file) : null;
}

function clearPhoto(): void {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photo.value = null;
  photoPreview.value = null;
}

async function confirmSend(): Promise<void> {
  if (sending.value || !canSend.value) return;
  sending.value = true;
  error.value = null;
  result.value = null;
  try {
    result.value = await broadcast(text.value.trim(), photo.value);
    confirming.value = false;
    text.value = "";
    clearPhoto();
  } catch (err) {
    error.value = localizeError(err);
    confirming.value = false;
  } finally {
    sending.value = false;
  }
}

onBeforeUnmount(() => {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
});
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.broadcast.title") }}</h1>

    <textarea
      v-model="text"
      rows="5"
      class="w-full resize-none rounded-2xl px-4 py-3 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
      :placeholder="t('admin.broadcast.text')"
      maxlength="4096"
    />

    <div class="rounded-2xl p-4 tg-card">
      <label class="block cursor-pointer text-sm font-medium tg-link">
        {{ photo ? t("admin.broadcast.photo_change") : t("admin.broadcast.photo") }}
        <input type="file" accept="image/*" class="sr-only" @change="onPhotoChange">
      </label>
      <div v-if="photoPreview" class="mt-3 flex flex-col gap-2">
        <img :src="photoPreview" :alt="t('admin.broadcast.photo')" class="max-h-48 w-fit rounded-xl object-cover">
        <button type="button" class="self-start text-xs font-medium tg-destructive" @click="clearPhoto">
          {{ t("common.remove") }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="rounded-xl px-4 py-3 text-sm font-semibold tg-button"
      :disabled="!canSend || sending"
      @click="confirming = true"
    >
      {{ sending ? t("admin.broadcast.sending") : t("admin.broadcast.send") }}
    </button>

    <div v-if="confirming" class="rounded-2xl p-4 text-sm tg-card tg-text">
      {{ t("admin.broadcast.confirm") }}
      <span class="mt-3 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-button"
          :disabled="sending"
          @click="confirmSend"
        >
          {{ t("common.confirm") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
          @click="confirming = false"
        >
          {{ t("common.cancel") }}
        </button>
      </span>
    </div>

    <p v-if="result" class="rounded-2xl px-4 py-3 text-sm tg-card tg-text">
      {{ t("admin.broadcast.result", { sent: result.sent, failed: result.failed }) }}
    </p>
    <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
