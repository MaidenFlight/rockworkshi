import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { api } from "@/lib/api";
import type { Mix, Mode } from "@/lib/audio/mix";
import type { Effects } from "@/lib/audio/takeEffects";
import { colors, fonts } from "@/lib/theme";

export type PresetSettings = Mix & { mode: Mode; focus: string | null; effects: Effects | null };
type Preset = { id: string; name: string; settings: PresetSettings };

// Named mixes saved to the student's account for this song, shared with the website.
export function MixPresets({
  songId,
  getSettings,
  onApply,
}: {
  songId: string;
  getSettings: () => PresetSettings;
  onApply: (settings: PresetSettings) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api(`/songs/${songId}/mix-presets`)
      .then((data) => setPresets(data.presets))
      .catch(() => setPresets([]));
  }, [songId]);

  async function save() {
    try {
      const { preset } = await api(`/songs/${songId}/mix-presets`, {
        method: "PUT",
        body: JSON.stringify({ name, settings: getSettings() }),
      });
      setPresets((list) =>
        [...list.filter((p) => p.id !== preset.id), preset].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
      setMessage(`Saved “${preset.name}”.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save the mix.");
    }
  }

  async function remove(preset: Preset) {
    try {
      await api(`/songs/${songId}/mix-presets/${preset.id}`, { method: "DELETE" });
      setPresets((list) => list.filter((p) => p.id !== preset.id));
      setMessage(`Deleted “${preset.name}”.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't delete the mix.");
    }
  }

  return (
    <View style={styles.wrap}>
      {presets.length === 0 ? <Text style={styles.hint}>No saved mixes for this song yet.</Text> : null}
      {presets.map((p) => (
        <View key={p.id} style={styles.preset}>
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
          </Text>
          <SmallButton
            label="Use"
            onPress={() => {
              onApply(p.settings);
              setMessage(`Using “${p.name}”.`);
            }}
            accessibilityLabel={`Use mix ${p.name}`}
          />
          <SmallButton label="Delete" onPress={() => remove(p)} accessibilityLabel={`Delete mix ${p.name}`} />
        </View>
      ))}
      <View style={styles.saveRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder="Name this mix, e.g. Drums up"
          placeholderTextColor={colors.meta}
          accessibilityLabel="Name for this mix"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && save()}
        />
        <SmallButton label="Save" onPress={save} disabled={!name.trim()} accessibilityLabel="Save this mix" />
      </View>
      {message ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  preset: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontWeight: "700", color: colors.ink },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  button: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  buttonText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
  disabled: { opacity: 0.5 },
  hint: { color: colors.meta, fontSize: 12.5, lineHeight: 18 },
});
