import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Prisma client and the AWS SDK are Node-only; keep them out of the bundle.
  serverExternalPackages: ["@prisma/client"],
  eslint: {
    dirs: ["src"],
  },
};

export default withNextIntl(nextConfig);
