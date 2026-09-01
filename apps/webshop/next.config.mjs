/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Product photos are always served from our own API (apps/api/uploads),
    // never a third-party host.
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
};

export default nextConfig;
