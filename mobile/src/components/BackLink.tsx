import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/Icon";
import { Text } from "@/components/Text";
import { colors } from "@/lib/theme";

export function BackLink({ label = "Back" }: { label?: string }) {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="link" style={styles.row}>
      <Icon name="arrow-left" size={16} color={colors.meta} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12 },
  text: { color: colors.meta },
});
