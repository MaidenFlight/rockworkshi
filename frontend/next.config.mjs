/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  allowedDevOrigins: ["10.26.211.5"],
};

export default nextConfig;
