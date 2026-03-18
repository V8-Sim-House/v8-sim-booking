import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Book Your Event — V8 Sim",
  description: "Book a V8 Sim racing simulator experience for your private event.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}
