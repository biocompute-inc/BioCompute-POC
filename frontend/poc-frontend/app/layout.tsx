import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Inter, Playfair_Display } from "next/font/google";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Mo, The Future of DNA Storage (powered by BioCompute Inc.)",
  icons: {
    icon: "/faviconfinal.png",
  },
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${playfair.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
