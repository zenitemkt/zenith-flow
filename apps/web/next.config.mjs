/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zenith/ui"],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
