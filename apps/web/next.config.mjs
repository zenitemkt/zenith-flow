/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zenite-mkt/ui"],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
