import { localizeApiError } from "../api";
import { adminBroadcast, requireAdmin } from "../admin";
import { confirmAction } from "../dialog";
import { q, qs } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";

onPage(() => {
  const root = q<HTMLElement>("#page-admin-broadcast");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const textarea = qs<HTMLTextAreaElement>("[data-broadcast-text]", root);
  const fileInput = qs<HTMLInputElement>("[data-broadcast-file]", root);
  const photoLabel = qs<HTMLElement>("[data-broadcast-photo-label]", root);
  const previewBox = qs<HTMLElement>("[data-broadcast-preview]", root);
  const image = qs<HTMLImageElement>("[data-broadcast-image]", root);
  const clearButton = qs<HTMLButtonElement>("[data-broadcast-clear]", root);
  const sendButton = qs<HTMLButtonElement>("[data-broadcast-send]", root);
  const resultLine = qs<HTMLElement>("[data-broadcast-result]", root);
  const errorLine = qs<HTMLElement>("[data-broadcast-error]", root);

  let photo: File | null = null;
  let previewUrl: string | null = null;
  let sending = false;
  let error: string | null = null;
  let result: { sent: number; failed: number } | null = null;
  let allowed = false;

  function canSend(): boolean {
    return Boolean(textarea.value.trim() || photo);
  }

  function render(): void {
    sendButton.disabled = !allowed || !canSend() || sending;
    sendButton.textContent = sending ? t("admin.broadcast.sending") : t("admin.broadcast.send");
    photoLabel.textContent = photo ? t("admin.broadcast.photo_change") : t("admin.broadcast.photo");
    photoLabel.dataset.i18n = photo ? "admin.broadcast.photo_change" : "admin.broadcast.photo";

    previewBox.hidden = !previewUrl;
    if (previewUrl) {
      image.src = previewUrl;
      image.alt = t("admin.broadcast.photo");
    }

    resultLine.hidden = !result;
    resultLine.textContent = result
      ? t("admin.broadcast.result", { sent: result.sent, failed: result.failed })
      : "";
    errorLine.hidden = !error;
    errorLine.textContent = error ?? "";
  }

  function clearPhoto(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    photo = null;
    previewUrl = null;
    fileInput.value = "";
    render();
  }

  function onFileChange(): void {
    const file = fileInput.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    photo = file;
    previewUrl = file ? URL.createObjectURL(file) : null;
    render();
  }

  async function send(): Promise<void> {
    if (sending || !canSend()) return;
    const confirmed = await confirmAction({
      message: t("admin.broadcast.confirm"),
    });
    if (!confirmed) return;

    sending = true;
    error = null;
    result = null;
    render();
    try {
      result = await adminBroadcast(textarea.value.trim(), photo);
      textarea.value = "";
      clearPhoto();
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      sending = false;
      render();
    }
  }

  textarea.addEventListener("input", render, { signal });
  fileInput.addEventListener("change", onFileChange, { signal });
  clearButton.addEventListener("click", clearPhoto, { signal });
  sendButton.addEventListener("click", () => void send(), { signal });
  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, { once: true });

  render();
  void requireAdmin().then((isAdmin) => {
    allowed = isAdmin;
    render();
  });
});
