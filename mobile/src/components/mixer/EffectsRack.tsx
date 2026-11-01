import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEFAULT_EFFECTS, EFFECT_PRESETS, Effects, REVERB_SIZES } from "@/lib/audio/takeEffects";
import { colors } from "@/lib/theme";
import { Slider } from "./Slider";

const signedDb = (v: number) => `${v > 0 ? "+" : ""}${v} dB`;

function sameSettings(a: Effects, b: Effects) {
  return (Object.keys(DEFAULT_EFFECTS) as (keyof Effects)[]).every((k) => a[k] === b[k]);
}

// EQ, drive, reverb and output level for the student's take. These only shape playback:
// the take itself stays exactly as recorded, and that's what a teacher receives.
export function EffectsRack({ fx, onChange }: { fx: Effects; onChange: (fx: Effects) => void }) {
  const set = (patch: Partial<Effects>) => onChange({ ...fx, ...patch });
  const off = fx.bypass;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EFFECTS ON YOUR TAKE</Text>
        <Chip label={fx.bypass ? "Bypassed" : "Bypass"} active={fx.bypass} onPress={() => set({ bypass: !fx.bypass })} />
        <Chip label="Reset" active={false} onPress={() => onChange({ ...DEFAULT_EFFECTS })} />
      </View>

      <View style={styles.row}>
        {EFFECT_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            active={sameSettings({ ...p.settings, bypass: fx.bypass }, fx)}
            onPress={() => onChange({ ...p.settings })}
          />
        ))}
      </View>

      <View style={[styles.controls, off && styles.off]}>
        <Control label="Low" value={fx.low} min={-12} max={12} step={0.5} format={signedDb} onChange={(low) => set({ low })} disabled={off} />
        <Control label="Mid" value={fx.mid} min={-12} max={12} step={0.5} format={signedDb} onChange={(mid) => set({ mid })} disabled={off} />
        <Control label="High" value={fx.high} min={-12} max={12} step={0.5} format={signedDb} onChange={(high) => set({ high })} disabled={off} />
        <Control label="Drive" value={fx.drive} onChange={(drive) => set({ drive })} disabled={off} />
        <Control label="Reverb" value={fx.reverb} onChange={(reverb) => set({ reverb })} disabled={off} />
        <View style={styles.row}>
          {REVERB_SIZES.map((s) => (
            <Chip key={s.id} label={s.label} active={fx.size === s.id} onPress={() => set({ size: s.id })} disabled={off} small />
          ))}
        </View>
        <Control
          label="Output"
          value={fx.output}
          min={-12}
          max={6}
          step={0.5}
          format={signedDb}
          onChange={(output) => set({ output })}
          disabled={off}
        />
      </View>
      <Text style={styles.hint}>
        Effects only change how your take sounds while you listen. The recording stays as you played it, and that&apos;s
        what your teacher hears.
      </Text>
    </View>
  );
}

function Control({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v: number) => `${v}%`,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <View>
      <View style={styles.controlHead}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format(value)}</Text>
      </View>
      <Slider label={label} value={value} onChange={onChange} min={min} max={max} step={step} format={format} disabled={disabled} />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  eyebrow: { flex: 1, color: colors.lagoon, fontSize: 11.5, fontWeight: "700", letterSpacing: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  controls: { gap: 4, marginTop: 4 },
  off: { opacity: 0.5 },
  controlHead: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontWeight: "700", fontSize: 13, color: colors.ink },
  value: { fontSize: 12.5, color: colors.body, fontVariant: ["tabular-nums"] },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSmall: { paddingVertical: 5, paddingHorizontal: 10 },
  chipActive: { borderColor: colors.flareAction, backgroundColor: colors.flareWash },
  chipText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
  chipTextActive: { color: colors.flareInk },
  hint: { color: colors.meta, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
