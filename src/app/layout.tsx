import type { Metadata } from "next";
import "./globals.css";
import SafeCallModal from "@/components/SafeCallModal";

export const metadata: Metadata = {
  title: "Moby Split — Group expense sharing",
  description: "Split bills with friends in Belarusian Rubles",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <SafeCallModal />
      </body>
    </html>
  );
}
