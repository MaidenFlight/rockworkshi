/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  // Next blocks cross-origin requests to dev-only assets, which otherwise
  // leaves the app served but never hydrated when it's opened from a phone via
  // this machine's LAN IP. That IP is a DHCP lease and changes between
  // sessions, so allow the private ranges instead of pinning one address.
  // "*" matches a single dot-separated segment, so these cover RFC 1918.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
};

export default nextConfig;
