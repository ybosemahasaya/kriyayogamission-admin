import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "kym-admin-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

/** Defaults to dark; "light" exactly mirrors the public site's palette
 * (see index.css [data-theme="light"]). Persisted so a refresh doesn't
 * reset your preference. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return { theme, toggleTheme } as const;
}
