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
};

export default nextConfig;
