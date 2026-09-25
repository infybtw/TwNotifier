import { applyTelegramTheme, getTelegramWebApp } from "~/composables/useTelegram";

export default defineNuxtPlugin((nuxtApp) => {
  const wa = getTelegramWebApp();
  if (!wa) return;

  wa.ready();
  wa.expand();
  applyTelegramTheme(wa);

  const onThemeChanged = () => applyTelegramTheme(wa);
  wa.onEvent("themeChanged", onThemeChanged);
  wa.onEvent("viewportChanged", onThemeChanged);

  const router = useRouter();
  const onBack = () => {
    if (window.history.length > 1) router.back();
  };

  router.afterEach((to) => {
    if (to.path === "/") wa.BackButton.hide();
    else wa.BackButton.show();
  });

  wa.BackButton.onClick(onBack);

  window.addEventListener("pagehide", () => {
    wa.offEvent("themeChanged", onThemeChanged);
    wa.offEvent("viewportChanged", onThemeChanged);
    wa.BackButton.offClick(onBack);
  }, { once: true });
});
