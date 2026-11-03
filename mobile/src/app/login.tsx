import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";
import { colors, fonts } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>ROCK WORKS</Text>
      <Text style={styles.sub}>Sign in to your lessons</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 24, justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 64, color: colors.flare, lineHeight: 60 },
  sub: { color: colors.page, fontSize: 16, marginBottom: 32 },
  input: { backgroundColor: colors.surface, borderRadius: 3, padding: 14, fontSize: 16, fontFamily: fonts.body, marginBottom: 12 },
  error: { color: colors.flare, marginBottom: 12 },
  button: { backgroundColor: colors.flareAction, padding: 16, borderRadius: 3, alignItems: "center" },
  buttonText: { fontWeight: "700", fontSize: 15, color: colors.white },
});
