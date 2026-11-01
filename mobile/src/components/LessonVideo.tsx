import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "@/lib/theme";

type Props = { uri: string; speed: number };

// Give this a key={uri} where it's used, so switching videos builds a fresh player.
export function LessonVideo({ uri, speed }: Props) {
  const player = useVideoPlayer(uri);
  const { status } = useEvent(player, "statusChange", { status: player.status });

  // The player is a native object, not React state, so changes are pushed to it.
  // expo-video has no setter method; assigning the property is the documented way.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = speed;
  }, [player, speed]);

  if (status === "error") {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={styles.message}>This video could not be loaded.</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.box}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.ink, borderRadius: 12, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  message: { color: colors.page, opacity: 0.7, textAlign: "center" },
});
