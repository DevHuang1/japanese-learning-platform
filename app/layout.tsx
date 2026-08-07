import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_JP, Sawarabi_Mincho, Padauk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const sawarabiMincho = Sawarabi_Mincho({
  variable: "--font-sawarabi-mincho",
  weight: "400",
  subsets: ["latin"],
});

const padauk = Padauk({
  variable: "--font-padauk",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "和学 — Japanese Learning Platform",
    template: "%s · 和学",
  },
  description:
    "Local-first JLPT N5/N4 study platform: flashcards with SM-2 spaced repetition, interactive reader, AI quizzes and progress tracking.",
};

export const viewport: Viewport = {
  themeColor: "#F9F6F0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSerifJp.variable} ${sawarabiMincho.variable} ${padauk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
