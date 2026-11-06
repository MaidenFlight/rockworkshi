import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { BackLink } from "@/components/BackLink";
import { Icon } from "@/components/Icon";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { Assignment, assignmentTitle, hasLoop, sendForReview, statusLabel } from "@/lib/assignments";
import { deleteSavedTake, getSavedTake, SavedTake } from "@/lib/takes";
import { colors, fonts } from "@/lib/theme";

function clock(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AssignmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = still loading, null = failed
  const [assignment, setAssignment] = useState<Assignment | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [take, setTake] = useState<SavedTake | null>(null);
  const [includeTake, setIncludeTake] = useState(true);
  const [progress, setProgress] = useState<number | null>(null); // set while sending
  const [sendError, setSendError] = useState("");

  // Reload on every visit: coming back from the player may have saved a take.
  useFocusEffect(
    useCallback(() => {
      setTake(getSavedTake(id));
      api(`/assignments/${id}`)
        .then((data) => setAssignment(data.assignment))
        .catch((e) => {
          setError(e.message);
          setAssignment(null);
        });
    }, [id])
  );

  async function send() {
    if (!assignment) return;
    setSendError("");
    setProgress(0);
    try {
      await sendForReview(assignment.id, includeTake ? take : null, setProgress);
      setTake(getSavedTake(assignment.id));
      const data = await api(`/assignments/${assignment.id}`);
      setAssignment(data.assignment);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send it. Try again.");
    } finally {
      setProgress(null);
    }
  }

  function removeTake() {
    Alert.alert("Delete this take?", "It's only on this phone, so it can't be brought back.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteSavedTake(id);
          setTake(null);
        },
      },
    ]);
  }

  if (assignment === undefined) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.flareAction} />
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.meta}>{error || "Not found."}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const a = assignment;
  const item = a.song || a.lesson;
  const sending = progress !== null;
  const times = hasLoop(a) ? `${clock(a.sectionStart)}–${clock(a.sectionEnd)}` : "";

  function practise() {
    if (a.song) router.push({ pathname: "/song/[id]", params: { id: a.song.id, assignment: a.id } });
    else if (a.lesson) router.push({ pathname: "/lesson/[id]", params: { id: a.lesson.id } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink />

        <Text style={styles.title}>{assignmentTitle(a)}</Text>
        <Text style={styles.meta}>{[item?.artist, `From ${a.teacher?.name || "your teacher"}`].filter(Boolean).join(" · ")}</Text>

        <View style={[styles.pill, a.status === "reviewed" && styles.pillDone, a.status === "ready" && styles.pillWaiting]}>
          <Text style={[styles.pillText, a.status === "reviewed" && styles.pillTextDone]}>{statusLabel(a)}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>
            {[a.instrument, `Level ${a.level}${a.levelName ? ` · ${a.levelName}` : ""}`].join(" · ")}
          </Text>
          {a.section || times ? (
            <Text style={styles.body}>
              Section: {[a.section, times].filter(Boolean).join(", ")}
              {times && a.song ? " (the player loops it for you)" : ""}
            </Text>
          ) : null}
          <Text style={[styles.sectionTitle, styles.gapTop]}>What to practise</Text>
          <Text style={styles.body}>{a.instruction}</Text>

          {item ? (
            <Pressable onPress={practise} style={[styles.primary, styles.gapTop]}>
              <Text style={styles.primaryText}>{a.song ? "Practise with the band" : "Open the lesson"}</Text>
            </Pressable>
          ) : (
            <Text style={[styles.meta, styles.gapTop]}>This song or lesson has been removed from the library.</Text>
          )}
        </View>

        <Text style={styles.heading}>SEND FOR REVIEW</Text>
        {a.status === "ready" ? (
          <View style={styles.panel}>
            <Text style={styles.body}>
              Sent {when(a.submissions[0]?.createdAt ?? a.createdAt)}. Your teacher&apos;s feedback will show up below.
            </Text>
          </View>
        ) : (
          <View style={styles.panel}>
            {a.song ? (
              take ? (
                <View style={styles.takeRow}>
                  <Pressable
                    onPress={() => setIncludeTake((v) => !v)}
                    disabled={sending}
                    style={[styles.check, includeTake && styles.checkOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: includeTake }}
                    accessibilityLabel="Send my saved take"
                  >
                    {includeTake ? <Icon name="check" size={18} color={colors.white} /> : null}
                  </Pressable>
                  <View style={styles.takeInfo}>
                    <Text style={styles.label}>Send my saved take</Text>
                    <Text style={styles.meta}>
                      {clock(take.duration)} · saved {when(take.savedAt)}
                    </Text>
                  </View>
                  <Pressable onPress={removeTake} disabled={sending} hitSlop={8}>
                    <Text style={styles.link}>Delete</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.meta}>
                  Optional: record yourself in the player and tap Save take. Your teacher hears it with the band.
                </Text>
              )
            ) : null}

            <Pressable onPress={send} disabled={sending} style={[styles.primary, styles.gapTop, sending && styles.disabled]}>
              <Text style={styles.primaryText}>
                {sending
                  ? take && includeTake
                    ? `Uploading ${Math.round((progress ?? 0) * 100)}%`
                    : "Sending…"
                  : "Mark ready for review"}
              </Text>
            </Pressable>
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            <Text style={[styles.meta, styles.gapTop]}>
              Only your teacher can hear your recording or read their feedback.
            </Text>
          </View>
        )}

        <Text style={styles.heading}>FEEDBACK</Text>
        {a.submissions.length === 0 ? (
          <Text style={styles.meta}>Nothing sent yet.</Text>
        ) : (
          a.submissions.map((s) => (
            <View key={s.id} style={[styles.panel, styles.feedback]}>
              <Text style={styles.meta}>
                Sent {when(s.createdAt)}
                {s.recording ? ` · with a ${clock(s.recording.duration)} recording` : ""}
              </Text>
              {s.feedback ? (
                <>
                  <Text style={[styles.body, styles.gapTop]}>{s.feedback}</Text>
                  {s.reviewedAt ? <Text style={[styles.meta, styles.gapTop]}>{when(s.reviewedAt)}</Text> : null}
                </>
              ) : (
                <Text style={[styles.body, styles.gapTop]}>Waiting for your teacher.</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  content: { padding: 16, paddingBottom: 48 },
  link: { color: colors.flareInk, fontWeight: "600" },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, lineHeight: 46 },
  meta: { color: colors.meta, fontSize: 13, lineHeight: 19 },
  body: { color: colors.body, lineHeight: 21 },
  label: { fontWeight: "700", color: colors.ink, marginBottom: 4 },
  gapTop: { marginTop: 12 },
  heading: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginTop: 24, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, padding: 16 },
  feedback: { marginBottom: 10 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginVertical: 12,
  },
  pillWaiting: { backgroundColor: colors.flareWash, borderColor: colors.flareWash },
  pillDone: { backgroundColor: colors.lagoon, borderColor: colors.lagoon },
  pillText: { fontSize: 12, fontWeight: "700", color: colors.flareInk },
  pillTextDone: { color: colors.white },
  primary: { backgroundColor: colors.flareAction, borderRadius: 3, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontWeight: "700", fontSize: 15, color: colors.white },
  disabled: { opacity: 0.6 },
  error: { color: colors.flareInk, marginTop: 8 },
  takeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  takeInfo: { flex: 1 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkOn: { backgroundColor: colors.lagoon, borderColor: colors.lagoon },
});
