/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
};

export default nextConfig;
