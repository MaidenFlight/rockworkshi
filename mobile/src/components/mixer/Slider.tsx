import { ComponentRef, useRef } from "react";
import { GestureResponderEvent, StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";

type Props = {
  label: string; // read by screen readers
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
  dim?: boolean;
};

const DRAG_SLOP = 6; // px of sideways movement before a touch counts as a drag

// A plain-JS slider, so it needs no new native module (and no new app build).
// Drag sideways or tap to set; a vertical drag is left to the scroll view.
// Screen readers treat it as adjustable: swipe up/down steps it and hears the value text.
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v) => `${v}%`,
  disabled = false,
  dim = false,
}: Props) {
  const trackRef = useRef<ComponentRef<typeof View>>(null);
  const geometry = useRef({ pageX: 0, width: 1 });
  const touch = useRef({ x0: 0, y0: 0, dragging: false });

  function measure() {
    trackRef.current?.measure((_x, _y, width, _h, pageX) => {
      geometry.current = { pageX, width: width || 1 };
    });
  }

  function valueAt(pageX: number) {
    const t = Math.max(0, Math.min(1, (pageX - geometry.current.pageX) / geometry.current.width));
    return Math.round(Math.round((min + t * (max - min)) / step) * step * 100) / 100;
  }

  function onMove(e: GestureResponderEvent) {
    const { pageX, pageY } = e.nativeEvent;
    const t = touch.current;
    const dx = pageX - t.x0;
    if (!t.dragging && Math.abs(dx) > DRAG_SLOP && Math.abs(dx) > Math.abs(pageY - t.y0)) t.dragging = true;
    if (t.dragging) onChange(valueAt(pageX));
  }

  function onRelease(e: GestureResponderEvent) {
    const t = touch.current;
    const moved = Math.abs(e.nativeEvent.pageX - t.x0) > DRAG_SLOP || Math.abs(e.nativeEvent.pageY - t.y0) > DRAG_SLOP;
    if (t.dragging) onChange(valueAt(e.nativeEvent.pageX));
    else if (!moved) onChange(valueAt(t.x0)); // a tap jumps there
  }

  function nudge(direction: 1 | -1) {
    // Big ranges (0-100%) step by 5 for screen readers; dB ranges by one step.
    const amount = step * (max - min > 30 ? 5 : 1);
    onChange(Math.round(Math.max(min, Math.min(max, value + direction * amount)) * 100) / 100);
  }

  const fraction = (value - min) / (max - min || 1);

  return (
    <View
      ref={trackRef}
      onLayout={measure}
      style={[styles.touch, disabled && styles.disabled]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        if (e.nativeEvent.actionName === "increment") nudge(1);
        if (e.nativeEvent.actionName === "decrement") nudge(-1);
      }}
      onStartShouldSetResponder={() => !disabled}
      onResponderGrant={(e) => {
        measure();
        touch.current = { x0: e.nativeEvent.pageX, y0: e.nativeEvent.pageY, dragging: false };
      }}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      // Until it's clearly a sideways drag, a scroll view may take the touch over.
      onResponderTerminationRequest={() => !touch.current.dragging}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }, dim && styles.fillDim]} />
      </View>
      <View style={[styles.thumb, { left: `${fraction * 100}%` }, dim && styles.thumbDim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { height: 32, justifyContent: "center", marginHorizontal: 9 },
  disabled: { opacity: 0.45 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden", pointerEvents: "none" },
  fill: { height: "100%", backgroundColor: colors.flareAction },
  fillDim: { backgroundColor: colors.meta },
  thumb: {
    position: "absolute",
    width: 12,
    height: 24,
    marginLeft: -6,
    borderRadius: 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.flareAction,
    pointerEvents: "none",
  },
  thumbDim: { borderColor: colors.meta },
});
