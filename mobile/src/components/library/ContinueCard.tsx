import { Pressable, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { Icon } from "@/components/Icon";
import { Text } from "@/components/Text";
import { ContinueItem, formatClock, formatWhen } from "@/lib/library";
import { colors, fonts } from "@/lib/theme";

// The most recently opened song. The player reopens it where it was left, paused.
export function ContinueCard({ item }: { item: ContinueItem | null }) {
  if (!item) return null;
  const { song, position, lastOpenedAt } = item;
  return (
    <Link href={{ pathname: "/song/[id]", params: { id: song.id } }} asChild>
      {/* A plain style object: Link's asChild drops a Pressable style written as a function. */}
      <Pressable
        style={styles.card}
        android_ripple={{ color: colors.border }}
        accessibilityRole="button"
        accessibilityLabel={`Continue practising ${song.title}`}
      >
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {["Continue practising", song.hasTracks && position ? `at ${formatClock(position)}` : null, `opened ${formatWhen(lastOpenedAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.flareInk} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    marginBottom: 10,
  },
  text: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textTransform: "uppercase" },
  meta: { color: colors.meta, fontSize: 13 },
});
