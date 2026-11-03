import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { Link, useFocusEffect } from "expo-router";
import { api, NetworkError } from "@/lib/api";
import { ContinueCard } from "@/components/library/ContinueCard";
import { ContinueItem, formatClock } from "@/lib/library";
import { colors, fonts } from "@/lib/theme";

// Shapes from GET /term (backend/src/lib/terms.js). A song only appears once it's open.
type Slot = {
  month: number;
  unlockAtDisplay: string;
  unlockShort: string;
  state: "available" | "preparing" | "upcoming";
  song?: { id: string; title: string; artist: string | null; hasTracks: boolean };
  lesson?: { id: string; title: string } | null;
};
type Term =
  | { state: "none" }
  | {
      state: "active" | "upcoming" | "ended";
      group: { id: string; name: string; startDisplay: string; startShort: string; endDisplay: string };
      currentMonth: number | null;
      slots: Slot[];
      earlier: { id: string; name: string; songs: Slot[] }[];
    };
type TermResponse = { membership: "active" | "expired" | "none"; term: Term & { group?: { name: string } } };

// The student's term at a glance: this month's song, what's next, and earlier months to revisit.
// The song to continue with shows here too, merged in when it's this month's song.
export function YourTerm({ continueItem = null }: { continueItem?: ContinueItem | null }) {
  const [data, setData] = useState<TermResponse | null | undefined>(undefined);
  const [failure, setFailure] = useState("");

  const load = useCallback(() => {
    api("/term")
      .then((d: TermResponse) => {
        setData(d);
        setFailure("");
      })
      .catch((e) => {
        setFailure(e instanceof NetworkError ? "You're offline, so your term can't load." : `Your term couldn't load: ${e instanceof Error ? e.message : ""}`);
        setData(null);
      });
  }, []);

  // A month may have opened while the app was in the background, so reload on every visit.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const term = data?.membership === "active" ? data.term : null;
  const currentSong = term && term.state !== "none" ? term.slots.find((s) => s.month === term.currentMonth)?.song : undefined;
  const merged = Boolean(currentSong && continueItem?.song.id === currentSong.id);

  return (
    <>
      <View style={styles.tag}>
        <Text style={styles.heading} accessibilityRole="header">
          YOUR TERM
        </Text>
        {data === undefined ? (
          <ActivityIndicator color={colors.flareAction} accessibilityLabel="Loading your term" style={styles.loading} />
        ) : data === null ? (
          <View>
            <Text style={styles.body}>{failure}</Text>
            <Pressable onPress={load} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <TermBody data={data} leftOffAt={merged ? (continueItem?.position ?? null) : null} />
        )}
      </View>
      {merged ? null : <ContinueCard item={continueItem} />}
    </>
  );
}

function TermBody({ data, leftOffAt }: { data: TermResponse; leftOffAt: number | null }) {
  if (data.membership !== "active") {
    return (
      <>
        <Text style={styles.title}>{data.membership === "expired" ? "Your membership has ended" : "No active membership"}</Text>
        <Text style={styles.body}>
          {data.term.group ? `You're in ${data.term.group.name}. ` : ""}Renew your membership on the website to open your term&apos;s
          songs again.
        </Text>
      </>
    );
  }
  const term = data.term;
  if (term.state === "none") {
    return (
      <>
        <Text style={styles.title}>You&apos;re not in a term yet</Text>
        <Text style={styles.body}>
          Students learn one song a month in a three-month term group, which the school sets up when your lessons start. Ask
          us if you think you should be in one. The song library is open meanwhile.
        </Text>
      </>
    );
  }

  const current = term.slots.find((s) => s.month === term.currentMonth);
  const nextUpcoming = term.slots.find((s) => s.state === "upcoming");
  // This month is shown large above, so the list only carries the other two.
  const others = term.slots.filter((s) => s.month !== term.currentMonth);

  return (
    <>
      <Text style={styles.meta}>
        {term.group.name} ·{" "}
        {term.state === "ended" ? "finished" : term.state === "upcoming" ? `starts ${term.group.startShort}` : `month ${term.currentMonth} of 3`}
      </Text>

      {term.state === "upcoming" || !current ? (
        <>
          <Text style={styles.title}>Your first song is on its way</Text>
          <Text style={styles.body}>It unlocks {term.slots[0].unlockShort}.</Text>
        </>
      ) : current.state === "available" && current.song ? (
        <>
          <Text style={styles.title}>{current.song.title}</Text>
          <Text style={styles.body}>
            {[current.song.artist, leftOffAt ? `you left off at ${formatClock(leftOffAt)}` : null].filter(Boolean).join(" · ")}
          </Text>
          <Link href={{ pathname: "/song/[id]", params: { id: current.song.id } }} asChild>
            <Pressable style={styles.primary} accessibilityRole="button" android_ripple={{ color: colors.flareInk }}>
              <Text style={styles.primaryText}>Continue learning</Text>
            </Pressable>
          </Link>
          {current.lesson ? (
            <Link href={{ pathname: "/lesson/[id]", params: { id: current.lesson.id } }} asChild>
              <Pressable style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryText}>Watch the lesson</Text>
              </Pressable>
            </Link>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.title}>Your next song is being prepared</Text>
          <Text style={styles.body}>Your teachers are getting this month&apos;s song ready. It appears here as soon as it&apos;s published.</Text>
        </>
      )}

      <View style={styles.rows}>
        {others.map((s) => (
          <View key={s.month} style={styles.row}>
            <Text style={styles.month}>Month {s.month}</Text>
            {s.state === "available" && s.song ? (
              <Link href={{ pathname: "/song/[id]", params: { id: s.song.id } }} asChild>
                <Pressable style={styles.flex} accessibilityRole="link" accessibilityLabel={`Revisit ${s.song.title}`}>
                  <Text style={styles.link} numberOfLines={1}>
                    {s.song.title}
                  </Text>
                </Pressable>
              </Link>
            ) : (
              <Text style={styles.rowText}>
                {s.state === "preparing"
                  ? "Being prepared"
                  : s === nextUpcoming && term.currentMonth
                    ? `Coming next month · ${s.unlockShort}`
                    : `Unlocks ${s.unlockShort}`}
              </Text>
            )}
          </View>
        ))}
      </View>

      {term.earlier.length ? (
        <View style={styles.earlier}>
          <Text style={styles.earlierTitle}>Earlier terms</Text>
          {term.earlier.map((g) =>
            g.songs.map((s) =>
              s.song ? (
                <Link key={`${g.id}-${s.month}`} href={{ pathname: "/song/[id]", params: { id: s.song.id } }} asChild>
                  <Pressable accessibilityRole="link">
                    <Text style={styles.link}>
                      {g.name}: {s.song.title}
                    </Text>
                  </Pressable>
                </Link>
              ) : null
            )
          )}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // The Tag from DESIGN.md: square, with a flare rule across the top.
  tag: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopWidth: 5,
    borderTopColor: colors.flare,
    padding: 16,
    marginBottom: 12,
  },
  loading: { marginVertical: 16 },
  heading: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  meta: { color: colors.meta, fontSize: 13, marginBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textTransform: "uppercase", lineHeight: 28 },
  body: { color: colors.body, lineHeight: 20 },
  primary: { backgroundColor: colors.flareAction, borderRadius: 3, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  primaryText: { fontWeight: "700", fontSize: 15, color: colors.white },
  secondary: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryText: { fontWeight: "700", color: colors.ink },
  rows: { marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  month: { width: 68, fontWeight: "700", color: colors.ink },
  rowText: { flex: 1, color: colors.body, lineHeight: 20 },
  flex: { flex: 1 },
  link: { color: colors.flareInk, fontWeight: "700" },
  earlier: { marginTop: 10, gap: 4 },
  earlierTitle: { fontWeight: "700", color: colors.ink },
});
