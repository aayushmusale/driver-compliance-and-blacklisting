/** @type {import('next').NextConfig} */
export default {
  distDir: process.env.NEXT_DIST_DIR || ".next", // lets a test build live beside a running dev server
  serverExternalPackages: ["better-sqlite3"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
