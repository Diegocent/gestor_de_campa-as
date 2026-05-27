import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@open-wa/wa-automate", "bullmq"],
};

export default nextConfig;
