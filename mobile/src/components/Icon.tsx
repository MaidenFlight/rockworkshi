import { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// One icon set for the whole app, as a font: drawing them as SVG would need a new native build.
export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}
