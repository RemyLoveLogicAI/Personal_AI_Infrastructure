import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatsHUD | Spatial Operations",
  description: "3D Spatial Operations Center for Agent Telemetry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
