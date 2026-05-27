import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { DockNav } from "@/components/DockNav";
import { SideNav } from "@/components/SideNav";
import { NudgeToast } from "@/components/NudgeToast";
import { FirstRunTour } from "@/components/FirstRunTour";

export const metadata: Metadata = {
  title: "LogPose",
  description:
    "Set sail. The Log Pose only advances when today's voyages are done.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LogPose",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Mobile: 8rem + iOS home-indicator inset to clear the floating
          Dock. Desktop: no Dock, no safe-area, just normal padding. */}
      <body className="min-h-screen pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] lg:pb-12">
        <TopBar />
        <NudgeToast />
        <div className="mx-auto w-full max-w-7xl px-4 lg:flex lg:gap-8 lg:px-8">
          <SideNav />
          <main className="mx-auto w-full max-w-2xl pt-4 lg:max-w-none lg:flex-1 lg:pt-6">
            {children}
          </main>
        </div>
        <DockNav />
        <FirstRunTour />
      </body>
    </html>
  );
}
