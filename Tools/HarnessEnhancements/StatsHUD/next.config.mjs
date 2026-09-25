/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Same-origin proxy to the Operations Dashboard, which owns port 8765.
        // Keeps requests same-origin so they pass the dashboard's local-host check.
        source: "/api/telemetry",
        destination: "http://127.0.0.1:8765/api/telemetry",
      },
    ];
  },
  // Next 14's built-in lint step passes eslintrc-only options (useEslintrc,
  // extensions) that ESLint 9 removed. Lint runs via the `npx eslint .` CLI
  // instead; re-enable this if reverting to ESLint 8.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
