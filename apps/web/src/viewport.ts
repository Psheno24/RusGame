/** iOS PWA: CSS vh/dvh часто резервирует место под UI Safari, которого нет в standalone. */
export function syncViewportHeight() {
  const height = document.documentElement.clientHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

export function initViewportHeight() {
  syncViewportHeight();
  window.addEventListener("resize", syncViewportHeight);
  window.addEventListener("orientationchange", syncViewportHeight);
  window.addEventListener("pageshow", syncViewportHeight);
  window.visualViewport?.addEventListener("resize", syncViewportHeight);
}
