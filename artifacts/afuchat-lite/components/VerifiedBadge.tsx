import React from "react";
import { StyleSheet, View } from "react-native";
import { AfuChatLogo } from "@/components/AfuChatLogo";

type Props = {
  size?: number;
};

export function VerifiedBadge({ size = 18 }: Props) {
  return (
    <View
      style={[
        styles.ring,
        {
          width: size + 4,
          height: size + 4,
          borderRadius: (size + 4) / 2,
        },
      ]}
    >
      <AfuChatLogo size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(30,144,255,0.2)",
  },
});
