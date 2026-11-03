import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { Assignment, assignmentTitle, statusLabel } from "@/lib/assignments";
import { Library } from "@/lib/library";
import { YourTerm } from "@/components/YourTerm";
import { colors, fonts } from "@/lib/theme";

const WORK_PAGE_SIZE = 10;

type Lesson = { id: string; title: string; artist?: string; difficulty?: string; locked?: boolean };

export default function Home() {
  const { user, signOut } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [library, setLibrary] = useState<Library | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [workPage, setWorkPage] = useState(1);
  const [workPages, setWorkPages] = useState({ page: 1, totalPages: 1 });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/lessons")
      .then((data) => setLessons(data.lessons))
      .catch((e) => setError(e.message));
  }, []);

  // Statuses change while away (sent for review, feedback arrived), so reload on every visit.
  useFocusEffect(
    useCallback(() => {
      api(`/assignments?page=${workPage}&pageSize=${WORK_PAGE_SIZE}`)
        .then((data) => {
          setAssignments(data.assignments);
          setWorkPages(data.pagination);
        })
        .catch(() => setAssignments([]));
      // The library screen handles offline and retry; here the cards just show less.
      api("/library")
        .then(setLibrary)
        .catch(() => setLibrary(null));
    }, [workPage])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>PRACTICE</Text>
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
            <YourTerm continueItem={library?.continue ?? null} />
            <Link href="/library" asChild>
              <Pressable style={styles.card} android_ripple={{ color: colors.border }} accessibilityRole="link">
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
                    <Pressable style={styles.card} android_ripple={{ color: colors.border }}>
                      <View style={styles.cardRow}>
                        <Text style={styles.cardTitleFlex} numberOfLines={1}>
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
                {workPages.totalPages > 1 ? (
                  <View style={styles.pager} accessibilityLabel="Teacher work pages">
                    <PagerButton label="Previous" disabled={workPages.page <= 1} onPress={() => setWorkPage(workPages.page - 1)} />
                    <Text style={styles.pagerText}>
                      Page {workPages.page} of {workPages.totalPages}
                    </Text>
                    <PagerButton label="Next" disabled={workPages.page >= workPages.totalPages} onPress={() => setWorkPage(workPages.page + 1)} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>ALL LESSONS</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: "/lesson/[id]", params: { id: item.id } }} asChild>
            <Pressable style={styles.card} android_ripple={{ color: colors.border }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.metaTight}>
                {[item.artist, item.locked ? "Unlocks with your term" : item.difficulty].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

function PagerButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.pagerButton, disabled && styles.pagerButtonEnded]}
    >
      <Text style={styles.pagerButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 48, color: colors.ink },
  link: { color: colors.flareInk, fontWeight: "600" },
  meta: { color: colors.meta, marginBottom: 12 },
  metaTight: { color: colors.meta, marginTop: 2 },
  error: { color: colors.flareInk, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, padding: 16, marginBottom: 10 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textTransform: "uppercase" },
  cardTitleFlex: { flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.ink, textTransform: "uppercase" },
  badge: { fontSize: 11.5, fontWeight: "700", color: colors.flareInk, backgroundColor: colors.flareWash, paddingVertical: 3, paddingHorizontal: 8 },
  badgeDone: { color: colors.lagoon, backgroundColor: colors.labelStock },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  pagerText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  pagerButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  pagerButtonEnded: { opacity: 0.45 },
  pagerButtonText: { fontWeight: "700", fontSize: 13, color: colors.ink },
  headerBlock: { marginTop: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, marginTop: 20, marginBottom: 8 },
});
