import { qs } from "./dom";
import { t } from "./i18n";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
}

let activeResolve: ((value: boolean) => void) | null = null;

/**
 * Opens the single native <dialog> from the app shell and resolves whether the
 * user confirmed. Native modals provide the focus trap, Escape handling and
 * focus restoration that the old Vue component implemented by hand.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const dialog = qs<HTMLDialogElement>("#app-dialog");
  const title = qs<HTMLElement>("[data-dialog-title]", dialog);
  const message = qs<HTMLElement>("[data-dialog-message]", dialog);
  const confirm = qs<HTMLButtonElement>("[data-dialog-confirm]", dialog);
  const cancel = qs<HTMLButtonElement>("[data-dialog-cancel]", dialog);

  // A second request replaces the first one instead of stacking dialogs.
  if (activeResolve) {
    activeResolve(false);
    activeResolve = null;
    if (dialog.open) dialog.close();
  }

  title.textContent = options.title ?? "";
  title.hidden = !options.title;
  if (options.title) {
    dialog.setAttribute("aria-labelledby", "app-dialog-title");
    dialog.setAttribute("aria-describedby", "app-dialog-message");
    dialog.removeAttribute("aria-label");
  } else {
    dialog.removeAttribute("aria-labelledby");
    dialog.removeAttribute("aria-describedby");
    dialog.setAttribute("aria-label", options.message);
  }
  message.textContent = options.message;
  confirm.textContent = options.confirmLabel ?? t("common.confirm");
  cancel.textContent = options.cancelLabel ?? t("common.cancel");
  cancel.hidden = Boolean(options.hideCancel);
  confirm.className = options.destructive
    ? "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-secondary tg-destructive"
    : "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-button";
  cancel.className = "rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text";

  // Very old WebViews can lack <dialog>; keep a blocking native fallback.
  if (typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(options.message));
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const main = document.getElementById("app-main");
    const previousMainOverflow = main?.style.overflowY ?? "";
    const previousBodyOverflow = document.body.style.overflow;
    if (main) main.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";

    const cleanup = (): void => {
      confirm.removeEventListener("click", onConfirm);
      cancel.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancelEvent);
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("click", onBackdrop);
      if (main) main.style.overflowY = previousMainOverflow;
      document.body.style.overflow = previousBodyOverflow;
      activeResolve = null;
    };

    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const onConfirm = (): void => finish(true);
    const onCancel = (): void => finish(false);
    const onCancelEvent = (event: Event): void => {
      event.preventDefault();
      finish(false);
    };
    const onClose = (): void => finish(false);
    const onBackdrop = (event: MouseEvent): void => {
      if (event.target === dialog) finish(false);
    };

    activeResolve = finish;
    confirm.addEventListener("click", onConfirm);
    cancel.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancelEvent);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onBackdrop);

    dialog.showModal();
    confirm.focus();
  });
}

export function alertAction(message: string, confirmLabel?: string): Promise<boolean> {
  return confirmAction({
    message,
    confirmLabel: confirmLabel ?? t("common.close"),
    hideCancel: true,
  });
}
