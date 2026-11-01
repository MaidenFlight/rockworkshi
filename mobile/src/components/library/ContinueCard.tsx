import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { ContinueItem, formatClock, formatWhen } from "@/lib/library";
import { colors, fonts } from "@/lib/theme";

// The most recently opened song. The player reopens it where it was left, paused.
export function ContinueCard({ item }: { item: ContinueItem | null }) {
  if (!item) return null;
  const { song, position, lastOpenedAt } = item;
  return (
    <Link href={{ pathname: "/song/[id]", params: { id: song.id } }} asChild>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Continue practising ${song.title}`}
      >
        <View style={styles.text}>
          <Text style={styles.eyebrow}>CONTINUE PRACTISING</Text>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[song.artist, `opened ${formatWhen(lastOpenedAt)}`].filter(Boolean).join(" · ")}
            {song.hasTracks && position ? ` · at ${formatClock(position)}` : ""}
          </Text>
        </View>
        <Text style={styles.go}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.flareAction,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1 },
  eyebrow: { color: colors.lagoon, fontSize: 11.5, fontWeight: "700", letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  meta: { color: colors.meta, fontSize: 13 },
  go: { fontSize: 30, color: colors.flareAction, marginLeft: 8 },
});
