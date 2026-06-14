import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { ToastProvider } from "@/app/components/ui/ToastProvider";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ボランティー | あなたにぴったりの活動を見つけよう",
  description:
    "簡単な診断を通じて、あなたの特性に最も適したボランティア活動をご提案します",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${notoSansJP.variable} antialiased`}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
