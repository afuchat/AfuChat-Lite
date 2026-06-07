import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

type Props = {
  size?: number;
  /** Kept for API compatibility — PNG already carries its own colors */
  color?: string;
  style?: StyleProp<ImageStyle>;
};

export function AfuChatLogo({ size = 24, style }: Props) {
  return (
    <Image
      source={require("../assets/images/logo.png")}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
