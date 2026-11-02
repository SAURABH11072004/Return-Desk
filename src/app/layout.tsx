import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ReturnDesk", template: "%s · ReturnDesk" },
  description: "Returns, simplified. Track, review and resolve customer returns from one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        {/* Soft light falling from the top: depth without decoration competing with content. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          <div className="absolute -top-48 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -top-24 right-[-10%] h-[320px] w-[420px] rounded-full bg-open-dot/10 blur-3xl" />
        </div>
        <ToastProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-faint">
            ReturnDesk · Returns, simplified.
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
