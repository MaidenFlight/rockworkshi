import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Assignment, assignmentTitle, statusLabel } from "@/lib/assignments";
import { Library } from "@/lib/library";
import { ContinueCard } from "@/components/library/ContinueCard";
import { YourTerm } from "@/components/YourTerm";
import { colors, fonts } from "@/lib/theme";

type Lesson = { id: string; title: string; artist?: string; difficulty?: string; locked?: boolean };

export default function Home() {
  const { user, signOut } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [library, setLibrary] = useState<Library | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/lessons")
      .then((data) => setLessons(data.lessons))
      .catch((e) => setError(e.message));
  }, []);

  // Statuses change while away (sent for review, feedback arrived), so reload on every visit.
  useFocusEffect(
    useCallback(() => {
      api("/assignments")
        .then((data) => setAssignments(data.assignments))
        .catch(() => setAssignments([]));
      // The library screen handles offline and retry; here the cards just show less.
      api("/library")
        .then(setLibrary)
        .catch(() => setLibrary(null));
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>LESSONS</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>{[user?.name, user?.instrument].filter(Boolean).join(" · ")}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <YourTerm />
            <ContinueCard item={library?.continue ?? null} />
            <Link href="/library" asChild>
              <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} accessibilityRole="link">
                <Text style={styles.cardTitle}>SONG LIBRARY</Text>
                <Text style={styles.metaTight}>
                  {library
                    ? `${library.songs.length} songs · ${library.songs.filter((s) => s.hasTracks).length} with stems · ${library.songs.filter((s) => s.favorite).length} favourites`
                    : "Search, favourites, notes and play-along"}
                </Text>
              </Pressable>
            </Link>
            {assignments.length ? (
              <View>
                <Text style={styles.sectionTitle}>FROM YOUR TEACHER</Text>
                {assignments.map((a) => (
                  <Link key={a.id} href={{ pathname: "/assignment/[id]", params: { id: a.id } }} asChild>
                    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                      <View style={styles.cardRow}>
                        <Text style={[styles.cardTitle, styles.flex]} numberOfLines={1}>
                          {assignmentTitle(a)}
                        </Text>
                        <Text style={[styles.badge, a.status === "reviewed" && styles.badgeDone]}>{statusLabel(a)}</Text>
                      </View>
                      <Text style={styles.metaTight} numberOfLines={1}>
                        {[a.instrument, `Level ${a.level}`, a.section].filter(Boolean).join(" · ")}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>ALL LESSONS</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: "/lesson/[id]", params: { id: item.id } }} asChild>
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>
                {[item.artist, item.locked ? "Unlocks with your term" : item.difficulty].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 48, color: colors.ink },
  link: { color: colors.flareAction, fontWeight: "600" },
  meta: { color: colors.meta, marginBottom: 12 },
  metaTight: { color: colors.meta, marginTop: 2 },
  error: { color: colors.flareAction, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 10 },
  cardPressed: { opacity: 0.7 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  badge: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.flareInk,
    backgroundColor: colors.flareWash,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  badgeDone: { color: colors.white, backgroundColor: colors.lagoon },
  headerBlock: { marginTop: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, marginTop: 20, marginBottom: 8 },
});
