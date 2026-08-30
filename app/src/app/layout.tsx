import type { Metadata } from "next";
import { ToastProvider } from "@/app/components/ui/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ボランティ | あなたにぴったりの活動を見つけよう",
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
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
