import React from "react";
import Svg, { Path, Line, Defs, LinearGradient, Stop } from "react-native-svg";

type Props = {
  size?: number;
  /** Pass a hex color to override. Defaults to the gold gradient. */
  color?: string;
};

/**
 * AfuChat brand mark — chat bubble with the AfuChat inner symbol.
 * Defaults to gold; pass `color` to override.
 * Used for verified-user badges and the login logo.
 */
export function AfuChatLogo({ size = 24, color }: Props) {
  const id = `afuGold_${size}`;
  const useGradient = !color;
  const fill = color ?? `url(#${id})`;
  // Inner mark: white at 65% opacity — legible on both gold and any solid bg
  const ink = "rgba(255,255,255,0.72)";

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE066" />
          <Stop offset="0.5" stopColor="#FFB800" />
          <Stop offset="1" stopColor="#E08800" />
        </LinearGradient>
      </Defs>

      {/* ── Chat bubble ─────────────────────────────────────────── */}
      <Path
        d="M16 2C9.37 2 4 6.9 4 13C4 17.2 6.38 20.83 10 22.87L9.2 29.5L14.8 26.28C15.18 26.42 15.58 26.5 16 26.5C22.63 26.5 28 21.6 28 13C28 6.9 22.63 2 16 2Z"
        fill={fill}
      />

      {/* ── Outer arc — upper sweep (left to right) ─────────────── */}
      <Path
        d="M9.5 14.2C9.5 10.19 12.69 7 16 7C18.5 7 20.68 8.34 21.8 10.3"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* ── Outer arc — lower sweep (right to left) ─────────────── */}
      <Path
        d="M22.5 11.8C22.5 15.81 19.31 19 16 19C13.5 19 11.32 17.66 10.2 15.7"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* ── Center X ────────────────────────────────────────────── */}
      <Line
        x1="13.2" y1="10.2" x2="18.8" y2="15.8"
        stroke={ink} strokeWidth="2" strokeLinecap="round"
      />
      <Line
        x1="18.8" y1="10.2" x2="13.2" y2="15.8"
        stroke={ink} strokeWidth="2" strokeLinecap="round"
      />
    </Svg>
  );
}
