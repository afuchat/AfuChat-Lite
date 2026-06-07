import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const THEME_KEY = "afuchat_theme_v1";
const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((val) => {
        if (val === "light" || val === "dark" || val === "system") {
          setThemeModeState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
  };

  const toggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  const resolvedTheme: "light" | "dark" =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
