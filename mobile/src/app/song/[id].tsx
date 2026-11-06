import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { BackLink } from "@/components/BackLink";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { StemPlayer, TakeToSave, Track } from "@/components/StemPlayer";
import { FavoriteButton } from "@/components/library/FavoriteButton";
import { PracticeNotes } from "@/components/library/PracticeNotes";
import { useAuth } from "@/context/auth";
import { api, NetworkError } from "@/lib/api";
import { Assignment, hasLoop } from "@/lib/assignments";
import { Practice, Session } from "@/lib/library";
import { saveTake } from "@/lib/takes";
import { colors, fonts } from "@/lib/theme";

type SongInfo = { id: string; title: string; artist: string | null; level: string | null };
type SongTracks = { tracks: Track[]; myPart: string | null; mixLevel: number | null };
type Page = {
  song: SongInfo;
  practice: Practice;
  tracks: SongTracks | null; // null when the song has no stems yet, or they couldn't load
  tracksOffline: boolean;
  assignment: Assignment | null;
  // From the server's term rules; when not allowed the stems are refused anyway.
  access: { allowed: boolean; message: string | null };
};

export default function SongPlayAlong() {
  // assignment is set when the song was opened from a teacher's assignment.
  const { id, assignment: assignmentId } = useLocalSearchParams<{ id: string; assignment?: string }>();
  const { user } = useAuth();
  // undefined = still loading, null = failed (see failure)
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [failure, setFailure] = useState<{ offline: boolean; message: string } | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The practice row says whether the song exists; the tracks may 404 just because the
    // song has no stems yet, which still leaves notes and the favourite star to show.
    Promise.allSettled([
      api(`/songs/${id}/practice`),
      api(`/songs/${id}/tracks`),
      // The assignment only adds the loop and the save button, so the song still opens without it.
      assignmentId ? api(`/assignments/${assignmentId}`) : Promise.resolve(null),
    ]).then(([practice, tracks, assignment]) => {
      if (cancelled) return;
      if (practice.status === "rejected") {
        const e = practice.reason;
        setFailure({ offline: e instanceof NetworkError, message: e instanceof Error ? e.message : "Song not found." });
        setPage(null);
        return;
      }
      setFavorite(practice.value.practice.favorite);
      setPage({
        song: practice.value.song,
        practice: practice.value.practice,
        tracks: tracks.status === "fulfilled" ? tracks.value : null,
        tracksOffline: tracks.status === "rejected" && tracks.reason instanceof NetworkError,
        assignment: assignment.status === "fulfilled" ? (assignment.value?.assignment ?? null) : null,
        access: practice.value.access ?? { allowed: true, message: null },
      });
      setFailure(null);
    });
    // For "Continue practising". Not worth an error if it doesn't arrive.
    api(`/songs/${id}/practice/opened`, { method: "POST" }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, assignmentId, attempt]);

  if (page === undefined) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.flareAction} accessibilityLabel="Loading the song" />
      </SafeAreaView>
    );
  }

  if (!page) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.meta}>
          {failure?.offline ? "You're offline, so this song can't be loaded." : failure?.message || "Song not found."}
        </Text>
        <Pressable onPress={() => setAttempt((n) => n + 1)} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { song, practice, tracks, assignment } = page;
  const loop = assignment && hasLoop(assignment) ? { start: assignment.sectionStart, end: assignment.sectionEnd } : null;
  // Resume state only goes to the server when something changed, and at most every few seconds.
  const saveSession = (session: Session) =>
    api(`/songs/${song.id}/practice/session`, { method: "PUT", body: JSON.stringify({ session }) });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackLink />
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.title}>{song.title}</Text>
              <Text style={[styles.meta, styles.artist]}>
                {[song.artist, song.level, assignment ? "Practice from your teacher" : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <FavoriteButton
              songId={song.id}
              title={song.title}
              favorite={favorite}
              onChange={setFavorite}
              size={30}
              onError={(e) =>
                setNotice(e instanceof NetworkError ? "You're offline, so that favourite wasn't saved." : "That favourite wasn't saved.")
              }
            />
          </View>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {assignment && (
            <View style={styles.brief}>
              <Text style={styles.briefMeta}>
                {[
                  assignment.instrument,
                  `Level ${assignment.level}${assignment.levelName ? ` ${assignment.levelName}` : ""}`,
                  assignment.section,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.briefText}>{assignment.instruction}</Text>
            </View>
          )}

          {!page.access.allowed ? (
            <View style={styles.panel} accessibilityLiveRegion="polite">
              <Text style={styles.lockTitle}>{page.access.message}</Text>
              <Text style={styles.meta}>Your term&apos;s songs open month by month. See Your term on the home screen.</Text>
            </View>
          ) : tracks ? (
            <>
              {practice.session?.position && !loop ? (
                <Text style={[styles.meta, styles.hint]}>Opened where you left off. Tap Play when you&apos;re ready.</Text>
              ) : null}
              <StemPlayer
                tracks={tracks.tracks}
                myPart={tracks.myPart}
                initialLoop={loop}
                songId={song.id}
                mixLevel={tracks.mixLevel}
                resume={practice.session}
                onSaveSession={saveSession}
                onSaveTake={
                  assignment
                    ? (take: TakeToSave) => saveTake(assignment.id, take.samples, take.sampleRate, take.offset).then(() => {})
                    : undefined
                }
              />
            </>
          ) : (
            <View style={styles.panel}>
              {page.tracksOffline ? (
                <>
                  <Text style={styles.meta}>You&apos;re offline, so the band can&apos;t load.</Text>
                  <Pressable onPress={() => setAttempt((n) => n + 1)} style={[styles.button, styles.gapTop]} accessibilityRole="button">
                    <Text style={styles.buttonText}>Retry</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.meta}>This song&apos;s play-along is coming soon.</Text>
              )}
            </View>
          )}

          <View style={styles.notes}>
            {user ? <PracticeNotes key={song.id} songId={song.id} userId={user.id} initialNotes={practice.notes} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  content: { padding: 16, paddingBottom: 48 },
  link: { color: colors.flareInk, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, lineHeight: 46, textTransform: "uppercase" },
  artist: { marginBottom: 16 },
  meta: { color: colors.meta, lineHeight: 20 },
  hint: { marginBottom: 10, fontSize: 13 },
  notice: { color: colors.flareInk, marginBottom: 12 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, padding: 16 },
  gapTop: { marginTop: 12 },
  notes: { marginTop: 24 },
  lockTitle: { fontWeight: "700", color: colors.ink, marginBottom: 6 },
  button: {
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  buttonText: { fontWeight: "700", color: colors.ink },
  brief: {
    backgroundColor: colors.flareWash,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  briefMeta: { color: colors.flareInk, fontSize: 12.5, fontWeight: "700" },
  briefText: { color: colors.ink, lineHeight: 20 },
});
