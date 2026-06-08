import React from "react";
import { AfuChatLogo } from "@/components/AfuChatLogo";

type Props = {
  size?: number;
};

export function VerifiedBadge({ size = 22 }: Props) {
  return <AfuChatLogo size={size} />;
}
