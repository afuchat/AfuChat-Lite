import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
