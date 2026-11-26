import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Inter (variable, self-hosted by next/font) for the whole app; see --font-sans in globals.css. */
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "BridgeOne ERP", template: "%s | BridgeOne ERP" },
  description: "BridgeOne enterprise resource planning",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* Applies the saved theme before first paint (no light→dark flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Browser extensions (dark mode, screen filters) add attributes such as
          style="filter: none" to <body> before hydration; ignore those. */}
      <body suppressHydrationWarning className="min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}

