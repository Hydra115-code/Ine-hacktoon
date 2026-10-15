"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "ine-explora-theme";

function readStoredTheme(): Theme | null {
  try {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  } catch {
    // Algunos modos privados bloquean Storage; la cookie mantiene la preferencia.
  }

  const cookieTheme = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${THEME_KEY}=`))
    ?.split("=")[1];
  return cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : null;
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // La cookie inferior funciona como respaldo si Storage no está disponible.
  }
  document.cookie = `${THEME_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";

  useEffect(() => {
    const storedTheme = readStoredTheme();
    const domTheme = document.documentElement.dataset.theme;
    const nextTheme: Theme = storedTheme
      ? storedTheme
      : domTheme === "dark"
        ? "dark"
        : "light";

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    storeTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"}
      aria-pressed={isDark}
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
    >
      {isDark ? (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M20.3 15.7A8.5 8.5 0 0 1 8.3 3.7a8.5 8.5 0 1 0 12 12Z" />
        </svg>
      )}
    </button>
  );
}
