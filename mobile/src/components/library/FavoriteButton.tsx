import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

// Star toggle. Flips at once and puts it back if the save fails (offline, say).
export function FavoriteButton({
  songId,
  title,
  favorite,
  onChange,
  onError,
  size = 24,
}: {
  songId: string;
  title: string;
  favorite: boolean;
  onChange: (favorite: boolean) => void;
  onError?: (error: unknown) => void;
  size?: number;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !favorite;
    onChange(next);
    setBusy(true);
    try {
      await api(`/songs/${songId}/favorite`, { method: "PUT", body: JSON.stringify({ favorite: next }) });
    } catch (e) {
      onChange(!next);
      onError?.(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityLabel={`Favourite ${title}`}
      accessibilityState={{ checked: favorite, busy }}
      style={styles.button}
    >
      <Text style={[styles.star, { fontSize: size }, favorite && styles.on]}>{favorite ? "★" : "☆"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
  star: { color: colors.meta },
  on: { color: colors.flareAction },
});
