import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사다리타기",
  description: "Next.js와 Tailwind CSS로 만든 사다리타기 웹앱",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
