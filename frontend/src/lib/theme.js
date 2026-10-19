// Light/dark theme helper. The choice is stored in localStorage ("au-theme")
// and applied as <html data-theme="light|dark">. With no stored choice we
// follow the OS setting. index.html runs the same logic before React loads
// so the page never flashes the wrong theme.
const KEY = "au-theme";

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

export function getTheme() {
  return (
    getStoredTheme() ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light")
  );
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage blocked (private mode etc.) — still apply for this session
  }
  applyTheme(theme);
}
