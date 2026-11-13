import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adventure Cove",
  description: "Play Smart, Big Adventures",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <html>/<body>
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
