import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { BackLink } from "@/components/BackLink";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { api, NetworkError } from "@/lib/api";
import {
  EMPTY_FILTERS,
  Filters,
  Library,
  STEM_FILTERS,
  filterSongs,
  formatWhen,
  levelsIn,
  readLibraryCache,
  writeLibraryCache,
} from "@/lib/library";
import { Icon, IconName } from "@/components/Icon";
import { ContinueCard } from "@/components/library/ContinueCard";
import { FavoriteButton } from "@/components/library/FavoriteButton";
import { colors, fonts } from "@/lib/theme";

type LoadState = "loading" | "ready" | "offline" | "error";

export default function LibraryScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<Library | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    if (!user) return Promise.resolve();
    return api("/library")
      .then((fresh: Library) => {
        setData(fresh);
        setState("ready");
        writeLibraryCache(user.id, fresh);
      })
      .catch((e) => {
        // Fall back to the last copy this phone saw, if there is one.
        setData((current) => current ?? readLibraryCache(user.id));
        setState(e instanceof NetworkError ? "offline" : "error");
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => setRetrying(false));
  }, [user]);

  // Reload on every visit: favourites and notes may have changed on the song screen or the website.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function retry() {
    setRetrying(true);
    load();
  }

  const songs = useMemo(() => data?.songs ?? [], [data]);
  const levels = useMemo(() => levelsIn(songs), [songs]);
  const shown = useMemo(() => filterSongs(songs, filters), [songs, filters]);
  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  function setFavorite(id: string, favorite: boolean) {
    setData((d) => (d ? { ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, favorite } : s)) } : d));
  }

  const banners = (
    <>
      {state === "offline" && (
        <Banner
          text={
            data
              ? `You're offline. Showing your library as it was${data.savedAt ? ` ${formatWhen(data.savedAt)}` : ""}; favourites can't change until you're back.`
              : "You're offline, and this phone has no saved copy of your library yet."
          }
          onRetry={retry}
          retrying={retrying}
        />
      )}
      {state === "error" && <Banner text={`Your library couldn't be loaded: ${error}`} onRetry={retry} retrying={retrying} bad />}
      {notice ? <Banner text={notice} onDismiss={() => setNotice("")} /> : null}
    </>
  );

  const header = (
    <View>
      {banners}
      {data?.continue ? <ContinueCard item={data.continue} /> : null}

      <TextInput
        value={filters.query}
        onChangeText={(query) => set({ query })}
        placeholder="Search by song or artist"
        placeholderTextColor={colors.meta}
        accessibilityLabel="Search songs by title or artist"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={styles.search}
      />

      <Text style={styles.filterLabel}>Difficulty</Text>
      <View style={styles.chips}>
        <Chip label="All" active={!filters.level} onPress={() => set({ level: "" })} />
        {levels.map((l) => (
          <Chip key={l} label={l} active={filters.level === l} onPress={() => set({ level: l })} />
        ))}
      </View>

      <Text style={styles.filterLabel}>Stems</Text>
      <View style={styles.chips}>
        {STEM_FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} active={filters.stems === f.id} onPress={() => set({ stems: f.id })} />
        ))}
      </View>

      <View style={[styles.chips, styles.countRow]}>
        <Chip icon="star" label="Favourites" active={filters.favorites} onPress={() => set({ favorites: !filters.favorites })} />
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {shown.length} {shown.length === 1 ? "song" : "songs"}
        </Text>
        {filtering && (
          <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <BackLink />
      <Text style={styles.title}>SONG LIBRARY</Text>

      {state === "loading" && !data ? (
        <View style={styles.center} accessibilityLabel="Loading your library">
          <ActivityIndicator color={colors.flareAction} />
        </View>
      ) : !data ? (
        <View style={styles.center}>{banners}</View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.meta}>
                {songs.length === 0
                  ? "There are no songs in the library yet."
                  : filters.favorites && songs.every((s) => !s.favorite)
                    ? "You haven't starred any songs yet. Tap the star on a song to keep it here."
                    : "No songs match."}
              </Text>
              {filtering && (
                <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.link}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: song }) => (
            <View style={styles.card}>
              <Link href={{ pathname: "/song/[id]", params: { id: song.id } }} asChild>
                <Pressable style={styles.cardText} accessibilityRole="link">
                  <Text style={styles.cardTitle}>{song.title}</Text>
                  <Text style={styles.meta}>
                    {[song.locked && "Unlocks with your term", song.artist, song.level, song.hasTracks ? `${song.parts.length} stems` : "No stems yet"]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {song.hasNotes || song.lastOpenedAt ? (
                    <Text style={styles.metaSmall}>
                      {[song.hasNotes && "Has notes", song.lastOpenedAt && `Opened ${formatWhen(song.lastOpenedAt)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                </Pressable>
              </Link>
              <FavoriteButton
                songId={song.id}
                title={song.title}
                favorite={song.favorite}
                onChange={(fav) => setFavorite(song.id, fav)}
                onError={(e) =>
                  setNotice(
                    e instanceof NetworkError
                      ? "You're offline, so that favourite wasn't saved."
                      : `That favourite wasn't saved: ${e instanceof Error ? e.message : "try again"}`
                  )
                }
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Banner({
  text,
  onRetry,
  retrying,
  onDismiss,
  bad,
}: {
  text: string;
  onRetry?: () => void;
  retrying?: boolean;
  onDismiss?: () => void;
  bad?: boolean;
}) {
  return (
    <View style={[styles.banner, bad && styles.bannerBad]} accessibilityLiveRegion="polite">
      <Text style={styles.bannerText}>{text}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} disabled={retrying} style={styles.bannerButton} accessibilityRole="button">
          <Text style={styles.bannerButtonText}>{retrying ? "Trying…" : "Retry"}</Text>
        </Pressable>
      )}
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.bannerButton} accessibilityRole="button">
          <Text style={styles.bannerButtonText}>OK</Text>
        </Pressable>
      )}
    </View>
  );
}

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? <Icon name={icon} size={14} color={active ? colors.flareInk : colors.ink} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, marginBottom: 8 },
  list: { paddingBottom: 48 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.ink,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  filterLabel: { color: colors.ink, fontSize: 13.5, fontWeight: "700", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  countRow: { alignItems: "center", marginBottom: 12 },
  count: { flex: 1, color: colors.meta, textAlign: "right" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { borderColor: colors.flareAction, backgroundColor: colors.flareWash },
  chipText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
  chipTextActive: { color: colors.flareInk },
  link: { color: colors.flareInk, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    marginBottom: 10,
  },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textTransform: "uppercase" },
  meta: { color: colors.meta },
  metaSmall: { color: colors.meta, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 4,
    backgroundColor: colors.labelStock,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  bannerBad: { backgroundColor: colors.flareWash, borderColor: colors.flareWash },
  bannerText: { flex: 1, color: colors.ink, lineHeight: 19 },
  bannerButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  bannerButtonText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
});
