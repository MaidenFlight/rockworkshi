// An explicit NEXT_PUBLIC_API_URL always wins. Without one, fall back to the
// host the page was loaded from so the API resolves correctly whether that's
// localhost or the machine's LAN IP (which is a DHCP lease and changes between
// sessions when testing on a phone). Server-side rendering has no location, so
// it keeps using localhost.
const API_PORT = 4000;

function inferApiUrl() {
  if (typeof window === "undefined") return `http://localhost:${API_PORT}`;
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || inferApiUrl();
