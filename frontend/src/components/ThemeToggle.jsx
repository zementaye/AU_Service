import { useEffect, useState } from "react";
import { getTheme, getStoredTheme, setTheme, applyTheme } from "../lib/theme";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS setting live, but only until the person picks one themselves.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      if (!getStoredTheme()) setThemeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      className="notif-bell theme-toggle"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
    >
      <span className="theme-icon" aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}
