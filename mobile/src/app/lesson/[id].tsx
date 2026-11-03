import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { BackLink } from "@/components/BackLink";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LessonVideo } from "@/components/LessonVideo";
import { api } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

type Level = { n: number; name: string; blurb: string };

type Lesson = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  difficulty?: string;
  levels?: Level[];
  videoUrl: string | null;
  playthroughVideoUrl: string | null;
};

const SPEEDS = [0.5, 0.75, 1, 1.25];

export default function LessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = still loading, null = failed
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [videoType, setVideoType] = useState<"lesson" | "playthrough">("lesson");
  const [speed, setSpeed] = useState(1);
  const [openLevel, setOpenLevel] = useState<number | null>(1);

  useEffect(() => {
    api(`/lessons/${id}`)
      .then((data) => setLesson(data.lesson))
      .catch((e) => {
        setError(e.message);
        setLesson(null);
      });
  }, [id]);

  if (lesson === undefined) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.flareAction} />
      </SafeAreaView>
    );
  }

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.meta}>{error || "Lesson not found."}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back to lessons</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const uri = videoType === "lesson" ? lesson.videoUrl : lesson.playthroughVideoUrl;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink label="Lessons" />
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.meta}>
          {[lesson.artist, lesson.difficulty, lesson.key && `Key of ${lesson.key}`].filter(Boolean).join(" · ")}
        </Text>

        <View style={styles.row}>
          {(["lesson", "playthrough"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setVideoType(t)}
              style={[styles.pill, videoType === t && styles.pillActive]}
            >
              <Text style={[styles.pillText, videoType === t && styles.pillTextActive]}>
                {t === "lesson" ? "Lesson video" : "Playthrough"}
              </Text>
            </Pressable>
          ))}
        </View>

        {uri ? (
          <LessonVideo key={uri} uri={uri} speed={speed} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Video coming soon.</Text>
          </View>
        )}

        {uri ? (
          <View style={styles.row}>
            <Text style={[styles.meta, styles.speedLabel]}>Speed</Text>
            {SPEEDS.map((s) => (
              <Pressable key={s} onPress={() => setSpeed(s)} style={[styles.pill, speed === s && styles.pillActive]}>
                <Text style={[styles.pillText, speed === s && styles.pillTextActive]}>{s}x</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.heading}>FIVE LEVELS</Text>
        {(lesson.levels || []).map((lv) => {
          const open = openLevel === lv.n;
          return (
            <View key={lv.n} style={styles.level}>
              <Pressable style={styles.levelRow} onPress={() => setOpenLevel(open ? null : lv.n)}>
                <View style={[styles.dot, open && styles.dotActive]}>
                  <Text style={[styles.dotText, open && styles.dotTextActive]}>{lv.n}</Text>
                </View>
                <Text style={styles.levelName}>{lv.name}</Text>
              </Pressable>
              {open ? <Text style={styles.blurb}>{lv.blurb}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  content: { padding: 16, paddingBottom: 48 },
  link: { color: colors.flareInk, fontWeight: "600" },
  title: { fontFamily: fonts.display, fontSize: 48, color: colors.ink, lineHeight: 50 },
  meta: { color: colors.meta },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginVertical: 14 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillActive: { backgroundColor: colors.flareAction, borderColor: colors.flareAction },
  pillText: { fontWeight: "700", fontSize: 13, color: colors.ink },
  pillTextActive: { color: colors.white },
  speedLabel: { marginRight: 4 },
  placeholder: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.ink, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.page, opacity: 0.6 },
  heading: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, marginTop: 20, marginBottom: 4 },
  level: { borderBottomWidth: 1, borderBottomColor: colors.border },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  dotActive: { backgroundColor: colors.flareAction },
  dotText: { fontWeight: "700", fontSize: 13, color: colors.ink },
  dotTextActive: { color: colors.white },
  levelName: { fontWeight: "700", fontSize: 16, color: colors.ink },
  blurb: { color: colors.body, lineHeight: 21, marginLeft: 42, marginBottom: 16 },
});
