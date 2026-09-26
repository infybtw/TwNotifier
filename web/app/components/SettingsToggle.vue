<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

function toggle(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 tg-card">
    <span class="flex flex-col">
      <span class="text-sm font-medium tg-text">{{ label }}</span>
      <span v-if="description" class="text-xs tg-hint">{{ description }}</span>
    </span>
    <input
      type="checkbox"
      class="h-6 w-6 shrink-0 accent-[var(--tg-button)]"
      :checked="modelValue"
      :disabled="disabled"
      @change="toggle"
    >
  </label>
</template>
