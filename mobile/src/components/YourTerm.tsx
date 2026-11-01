import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { api, NetworkError } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

// Shapes from GET /term (backend/src/lib/terms.js). A song only appears once it's open.
type Slot = {
  month: number;
  unlockAtDisplay: string;
  state: "available" | "preparing" | "upcoming";
  song?: { id: string; title: string; artist: string | null; hasTracks: boolean };
  lesson?: { id: string; title: string } | null;
};
type Term =
  | { state: "none" }
  | {
      state: "active" | "upcoming" | "ended";
      group: { id: string; name: string; startDisplay: string; endDisplay: string };
      currentMonth: number | null;
      slots: Slot[];
      earlier: { id: string; name: string; songs: Slot[] }[];
    };
type TermResponse = { membership: "active" | "expired" | "none"; term: Term & { group?: { name: string } } };

// The student's term at a glance: this month's song, what's next, and earlier months to revisit.
export function YourTerm() {
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

  return (
    <View style={styles.panel} accessibilityLabel="Your term">
      <Text style={styles.eyebrow}>YOUR TERM</Text>
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
        <TermBody data={data} />
      )}
    </View>
  );
}

function TermBody({ data }: { data: TermResponse }) {
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

  return (
    <>
      <Text style={styles.meta}>
        {term.group.name} ·{" "}
        {term.state === "ended" ? "finished" : term.state === "upcoming" ? `starts ${term.group.startDisplay}` : `month ${term.currentMonth} of 3`}
      </Text>

      <View style={styles.feature}>
        {term.state === "upcoming" || !current ? (
          <>
            <Text style={styles.title}>Your first song is on its way</Text>
            <Text style={styles.body}>It unlocks {term.slots[0].unlockAtDisplay}.</Text>
          </>
        ) : current.state === "available" && current.song ? (
          <>
            <Text style={styles.small}>MONTH {current.month} · THIS MONTH&apos;S SONG</Text>
            <Text style={styles.title}>{current.song.title}</Text>
            {current.song.artist ? <Text style={styles.body}>{current.song.artist}</Text> : null}
            <Link href={{ pathname: "/song/[id]", params: { id: current.song.id } }} asChild>
              <Pressable style={styles.primary} accessibilityRole="button">
                <Text style={styles.primaryText}>CONTINUE LEARNING</Text>
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
            <Text style={styles.small}>MONTH {current.month}</Text>
            <Text style={styles.title}>Your next song is being prepared</Text>
            <Text style={styles.body}>Your teachers are getting this month&apos;s song ready. It appears here as soon as it&apos;s published.</Text>
          </>
        )}
      </View>

      {term.slots.map((s) => (
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
            <Text style={[styles.flex, styles.body]}>
              {s.state === "preparing"
                ? "Being prepared"
                : s === nextUpcoming && term.currentMonth
                  ? `Coming next month · ${s.unlockAtDisplay}`
                  : `Unlocks ${s.unlockAtDisplay}`}
            </Text>
          )}
        </View>
      ))}

      {term.earlier.length ? (
        <View style={styles.earlier}>
          <Text style={styles.small}>EARLIER TERMS</Text>
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
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: colors.flareAction,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  loading: { marginVertical: 16 },
  eyebrow: { color: colors.lagoon, fontSize: 11.5, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  meta: { color: colors.meta, fontSize: 13, marginBottom: 10 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  body: { color: colors.body, lineHeight: 20 },
  small: { color: colors.lagoon, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.5 },
  feature: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  primary: { backgroundColor: colors.flareAction, borderRadius: 4, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  primaryText: { fontFamily: fonts.display, fontSize: 19, color: colors.white },
  secondary: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryText: { fontWeight: "700", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  month: { width: 68, fontWeight: "700", color: colors.ink },
  flex: { flex: 1 },
  link: { color: colors.flareAction, fontWeight: "700" },
  earlier: { marginTop: 10, gap: 4 },
});
