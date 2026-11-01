import { Pressable, StyleSheet, Text, View } from "react-native";
import { Mix, stemOf } from "@/lib/audio/mix";
import { colors } from "@/lib/theme";
import { Slider } from "./Slider";

type Props = {
  parts: string[];
  mix: Mix;
  levels: Record<string, { audible: boolean; gain: number }>;
  onChange: (mix: Mix) => void;
  takeLabel: string | null; // null when there's no take
  onReset: () => void;
  disabled?: boolean;
};

// Volume, mute and solo per stem, plus the take and master. Changing any of these only
// moves gains on the running audio graph: playback, loops and speed carry on untouched.
export function MixerPanel({ parts, mix, levels, onChange, takeLabel, onReset, disabled }: Props) {
  const setStem = (part: string, patch: Partial<Mix["stems"][string]>) =>
    onChange({ ...mix, stems: { ...mix.stems, [part]: { ...stemOf(mix, part), ...patch } } });

  const anySolo = parts.some((p) => stemOf(mix, p).soloed);
  const bandSilent = parts.every((p) => !levels[p]?.audible);

  return (
    <View style={styles.list}>
      {parts.map((part) => {
        const stem = stemOf(mix, part);
        const audible = levels[part]?.audible;
        return (
          <Channel
            key={part}
            label={part}
            off={!audible}
            volume={stem.volume}
            onVolume={(volume) => setStem(part, { volume })}
            muted={stem.muted}
            onMute={() => setStem(part, { muted: !stem.muted })}
            soloed={stem.soloed}
            onSolo={() => setStem(part, { soloed: !stem.soloed })}
          />
        );
      })}

      {takeLabel && (
        <Channel
          label={takeLabel}
          off={mix.takeMuted}
          volume={mix.take}
          onVolume={(take) => onChange({ ...mix, take })}
          muted={mix.takeMuted}
          onMute={() => onChange({ ...mix, takeMuted: !mix.takeMuted })}
        />
      )}

      <View style={styles.masterRow}>
        <Channel label="Master" volume={mix.master} onVolume={(master) => onChange({ ...mix, master })} />
        <Pressable onPress={onReset} disabled={disabled} style={styles.reset} hitSlop={6} accessibilityRole="button">
          <Text style={styles.resetText}>Reset mix</Text>
        </Pressable>
      </View>

      {bandSilent || anySolo ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {bandSilent
            ? "The band is silent: the play mode, mute and solo leave no part playing."
            : "Solo is on: only soloed parts play. Your take has its own mute."}
        </Text>
      ) : null}
    </View>
  );
}

type ChannelProps = {
  label: string;
  volume: number;
  onVolume: (v: number) => void;
  off?: boolean;
  muted?: boolean;
  onMute?: () => void;
  soloed?: boolean;
  onSolo?: () => void;
};

function Channel({ label, volume, onVolume, off = false, muted, onMute, soloed, onSolo }: ChannelProps) {
  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.label, off && styles.labelOff]}>
          {label}
          {off ? " (off)" : ""}
        </Text>
        <Text style={styles.value}>{volume}%</Text>
        {onMute && (
          <Toggle text="M" pressed={!!muted} tone={colors.flareAction} onPress={onMute} accessibilityLabel={`Mute ${label}`} />
        )}
        {onSolo && <Toggle text="S" pressed={!!soloed} tone={colors.lagoon} onPress={onSolo} accessibilityLabel={`Solo ${label}`} />}
      </View>
      <Slider label={`${label} volume`} value={volume} onChange={onVolume} dim={off} />
    </View>
  );
}

function Toggle({
  text,
  pressed,
  tone,
  onPress,
  accessibilityLabel,
}: {
  text: string;
  pressed: boolean;
  tone: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: pressed }}
      style={[styles.toggle, pressed && { backgroundColor: tone, borderColor: tone }]}
    >
      <Text style={[styles.toggleText, pressed && styles.toggleTextOn]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontWeight: "700", fontSize: 13, color: colors.ink },
  labelOff: { color: colors.meta },
  value: { width: 44, textAlign: "right", fontSize: 12.5, color: colors.body, fontVariant: ["tabular-nums"] },
  toggle: {
    width: 30,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontWeight: "800", fontSize: 12, color: colors.ink },
  toggleTextOn: { color: colors.white },
  masterRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
  reset: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginTop: 4,
  },
  resetText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
  hint: { color: colors.meta, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
});
