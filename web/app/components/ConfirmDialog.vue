<script setup lang="ts">
/**
 * Modal confirmation dialog. Rendered in a Teleport so the overlay is not
 * clipped by the page layout, and styled after the app's palette rather than
 * Telegram's native `showConfirm`.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    busy?: boolean;
    hideCancel?: boolean;
  }>(),
  {
    title: undefined,
    message: undefined,
    confirmLabel: undefined,
    cancelLabel: undefined,
    destructive: false,
    busy: false,
    hideCancel: false,
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [];
  cancel: [];
}>();

const { t } = useLocale();

const confirmLabel = computed(() => props.confirmLabel ?? t("common.confirm"));
const cancelLabel = computed(() => props.cancelLabel ?? t("common.cancel"));

const dialogRef = ref<HTMLElement | null>(null);
const confirmRef = ref<HTMLButtonElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const titleId = `confirm-title-${useId()}`;
const messageId = `confirm-message-${useId()}`;

function close(): void {
  emit("update:open", false);
  emit("cancel");
}

function onBackdrop(): void {
  close();
}

function onConfirm(): void {
  if (props.busy) return;
  emit("confirm");
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;

  const focusables = dialogRef.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (!focusables || focusables.length === 0) return;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeydown);
      await nextTick();
      confirmRef.value?.focus();
    } else {
      document.removeEventListener("keydown", onKeydown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (typeof document === "undefined") return;
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <Transition name="tg-modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        role="presentation"
      >
        <div class="tg-modal-backdrop absolute inset-0" @click="onBackdrop" />
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-describedby="message ? messageId : undefined"
          class="tg-modal-panel relative w-full max-w-md rounded-2xl p-5 tg-card"
        >
          <h2 v-if="title" :id="titleId" class="text-base font-semibold tg-text">{{ title }}</h2>
          <p :id="messageId" class="text-sm tg-text" :class="{ 'mt-2': title }">
            <slot>{{ message }}</slot>
          </p>
          <div class="mt-4 flex gap-2">
            <button
              ref="confirmRef"
              type="button"
              class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold"
              :class="destructive ? 'tg-secondary tg-destructive' : 'tg-button'"
              :disabled="busy"
              @click="onConfirm"
            >
              {{ confirmLabel }}
            </button>
            <button
              v-if="!hideCancel"
              type="button"
              class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
              @click="close"
            >
              {{ cancelLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
