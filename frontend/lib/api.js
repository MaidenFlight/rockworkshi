// An explicit NEXT_PUBLIC_API_URL always wins.
const API_PORT = 4000;

function inferApiUrl() {
  if (typeof window === "undefined") return `http://localhost:${API_PORT}`;
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || inferApiUrl();
