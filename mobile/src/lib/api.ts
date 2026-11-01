import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// In development the API runs on the same PC as Metro, so reuse Metro's
// address (e.g. "10.24.65.37:8081") with the API's port. That keeps working
// when the PC joins a different Wi-Fi. EXPO_PUBLIC_API_URL overrides it.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : undefined);
const TOKEN_KEY = "rw_token";

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// Thrown when the request never reached the server, so screens can say "offline"
// rather than showing a server error.
export class NetworkError extends Error {
  constructor() {
    super("You're offline. Check your connection and try again.");
    this.name = "NetworkError";
  }
}

export async function api(path: string, options: RequestInit = {}) {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
