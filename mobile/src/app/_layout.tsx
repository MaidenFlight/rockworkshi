import { Stack } from "expo-router";
import { useFonts, BigShouldersDisplay_800ExtraBold } from "@expo-google-fonts/big-shoulders-display";
import { AuthProvider, useAuth } from "@/context/auth";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BigShouldersDisplay_800ExtraBold });
  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { user, loading } = useAuth();
  if (loading) return null;

  // Protected screens only exist when their guard is true, so a signed-out
  // user can't reach "index" and a signed-in one is moved off "login".
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lesson/[id]" />
        <Stack.Screen name="song/[id]" />
        <Stack.Screen name="assignment/[id]" />
        <Stack.Screen name="library" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
