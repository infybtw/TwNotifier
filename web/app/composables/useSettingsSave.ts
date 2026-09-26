import { useApiError } from "./useApi";
import type { Settings } from "./useAuth";

/** Field-level save helper for the settings screen. */
export function useSettingsSave() {
  const { saveSettings } = useAuth();
  const localizeError = useApiError();
  const saving = ref(false);
  const error = ref<string | null>(null);
  const saved = ref(false);
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  async function save(patch: Partial<Settings>): Promise<void> {
    saving.value = true;
    error.value = null;
    try {
      await saveSettings(patch);
      saved.value = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (saved.value = false), 1500);
    } catch (err) {
      error.value = localizeError(err);
    } finally {
      saving.value = false;
    }
  }

  onBeforeUnmount(() => {
    if (savedTimer) clearTimeout(savedTimer);
  });

  return { save, saving, error, saved };
}
