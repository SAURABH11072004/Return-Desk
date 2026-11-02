import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ReturnDesk", template: "%s · ReturnDesk" },
  description: "Returns, simplified. Manage customer return requests from intake through resolution.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <ToastProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 text-xs text-muted sm:px-6">
              <span>ReturnDesk</span>
              <span>Returns, simplified.</span>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
