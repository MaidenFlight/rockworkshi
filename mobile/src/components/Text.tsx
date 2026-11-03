import { StyleSheet, Text as RNText, TextProps } from "react-native";
import { fonts } from "@/lib/theme";

// Libre Franklin at the right weight, per DESIGN.md. Android can't pick a weight from a
// custom family, so a style's fontWeight chooses the loaded file instead. A style that
// names its own fontFamily (the Big Shoulders signage type) is left alone.
function familyFor(weight: unknown) {
  if (weight === "700" || weight === "800" || weight === "bold") return fonts.bodyBold;
  if (weight === "600") return fonts.bodySemi;
  return fonts.body;
}

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return <RNText {...props} style={style} />;
  return <RNText {...props} style={[style, { fontFamily: familyFor(flat.fontWeight), fontWeight: "normal" }]} />;
}
