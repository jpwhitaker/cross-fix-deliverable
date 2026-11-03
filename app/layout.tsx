import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import SoundSettings from "@/components/SoundSettings";
const plusJakartaSans = Plus_Jakarta_Sans({
    variable: "--font-plus-jakarta-sans",
    subsets: ["latin"],
    display: "swap",
});
const beVietnamPro = Be_Vietnam_Pro({
    variable: "--font-be-vietnam-pro",
    weight: ["300", "400", "500", "600"],
    subsets: ["latin"],
    display: "swap",
});
export const metadata: Metadata = {
    title: "CROSS-FIX | Ride the Wave of Words",
    description: "Experience CROSS-FIX: where high-stakes strategy meets the laid-back rhythm of Oahu. Craft your ride, carve through letters, and become a Master Kahuna.",
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en" suppressHydrationWarning className={`${plusJakartaSans.variable} ${beVietnamPro.variable} antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
      </head>
      <body className="bg-background text-on-surface font-body selection:bg-primary-container">
        <SoundSettings />
        {children}
      </body>
    </html>);
}
