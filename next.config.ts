import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Prevent Next.js Router Cache from serving stale page state
    // (ensures questionnaire always starts fresh when revisiting)
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
};

export default withNextIntl(nextConfig);
