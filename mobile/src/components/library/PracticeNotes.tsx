import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { File, Paths } from "expo-file-system";
import { api, NetworkError } from "@/lib/api";
import { colors, fonts } from "@/lib/theme";

const MAX_NOTES = 5000;
const SAVE_AFTER_MS = 1500;

// Unsent text is kept on the phone too, so going offline or leaving the song doesn't lose it.
function draftFile(userId: string, songId: string) {
  return new File(Paths.document, `notes-draft-${userId}-${songId}.txt`);
}
function readDraft(file: File) {
  try {
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}
function writeDraft(file: File, text: string | null) {
  try {
    if (text === null) {
      if (file.exists) file.delete();
      return;
    }
    file.create({ overwrite: true });
    file.write(text).catch(() => {});
  } catch {
    // The server copy still saves.
  }
}

type Status = "idle" | "saving" | "saved" | "offline" | "error";

// Private notes for one song. Saves itself a moment after typing stops.
export function PracticeNotes({ songId, userId, initialNotes }: { songId: string; userId: string; initialNotes: string | null }) {
  const [file] = useState(() => draftFile(userId, songId));
  const [savedText, setSavedText] = useState(initialNotes ?? "");
  // A draft left from an earlier visit isn't sent automatically: the note may have been
  // changed on the website since, so the student chooses.
  const [leftover] = useState(() => {
    const draft = readDraft(file);
    return draft !== null && draft !== (initialNotes ?? "") ? draft : null;
  });
  const [text, setText] = useState(leftover ?? initialNotes ?? "");
  const [holding, setHolding] = useState(leftover !== null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const latest = useRef({ text, savedText, holding });
  useEffect(() => {
    latest.current = { text, savedText, holding };
  });

  const dirty = text !== savedText;

  async function save(value = text) {
    setStatus("saving");
    try {
      const { notes } = await api(`/songs/${songId}/notes`, { method: "PUT", body: JSON.stringify({ notes: value }) });
      setSavedText(notes ?? "");
      setStatus("saved");
      writeDraft(file, null);
    } catch (e) {
      setStatus(e instanceof NetworkError ? "offline" : "error");
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
  }

  // Autosave once typing pauses.
  useEffect(() => {
    if (!dirty || holding) return;
    const id = setTimeout(() => save(text), SAVE_AFTER_MS);
    return () => clearTimeout(id);
    // save is recreated each render; text, dirty and holding are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty, holding]);

  // Leaving with unsaved text: send it on the way out. The draft file keeps it if that fails.
  useEffect(() => {
    return () => {
      const { text: pending, savedText: stored, holding: held } = latest.current;
      if (pending !== stored && !held) {
        api(`/songs/${songId}/notes`, { method: "PUT", body: JSON.stringify({ notes: pending }) })
          .then(() => writeDraft(file, null))
          .catch(() => {});
      }
    };
  }, [songId, file]);

  const statusText = {
    idle: holding ? "These changes from your last visit weren't saved." : dirty ? "Not saved yet" : "Only you can see these notes.",
    saving: "Saving…",
    saved: dirty ? "Not saved yet" : "Saved. Only you can see these notes.",
    offline: "You're offline. Your note is kept on this phone; tap Retry when you're back online.",
    error: `Couldn't save: ${error}`,
  }[status];

  return (
    <View>
      <Text style={styles.heading} accessibilityRole="header">MY PRACTICE NOTES</Text>
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          writeDraft(file, value);
          setHolding(false);
          if (status !== "saving") setStatus("idle");
        }}
        multiline
        maxLength={MAX_NOTES}
        placeholder="What to work on, tricky bars, chord shapes, tempo goals…"
        placeholderTextColor={colors.meta}
        accessibilityLabel="My practice notes"
        accessibilityHint="Saves automatically. Only you can see these notes."
        style={styles.input}
        textAlignVertical="top"
      />
      <View style={styles.row}>
        <Text
          style={[styles.status, (status === "offline" || status === "error") && styles.statusBad]}
          accessibilityLiveRegion="polite"
        >
          {statusText}
        </Text>
        <Text style={styles.count}>
          {text.length}/{MAX_NOTES}
        </Text>
      </View>
      <View style={styles.row}>
        {holding && (
          <>
            <SmallButton
              label="Save them"
              onPress={() => {
                setHolding(false);
                save();
              }}
            />
            <SmallButton
              label="Discard"
              onPress={() => {
                setHolding(false);
                setText(savedText);
                writeDraft(file, null);
              }}
            />
          </>
        )}
        {(status === "offline" || status === "error") && <SmallButton label="Retry" onPress={() => save()} />}
      </View>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: 8 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  status: { flex: 1, color: colors.meta, fontSize: 12.5, lineHeight: 18 },
  statusBad: { color: colors.flareInk },
  count: { color: colors.meta, fontSize: 12 },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  buttonText: { fontWeight: "700", fontSize: 12.5, color: colors.ink },
});
