import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AteWell Web",
  description: "Add grocery items from the web and sync to mobile via Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
