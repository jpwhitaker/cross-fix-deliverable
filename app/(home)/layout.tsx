import type { ReactNode } from "react";
import { Shrikhand, Nunito, Space_Mono } from "next/font/google";
import "./kids.css";
const shrikhand = Shrikhand({
    variable: "--font-shrikhand",
    subsets: ["latin"],
    weight: "400",
});
const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["400", "600", "700", "800", "900"],
});
const spaceMono = Space_Mono({
    variable: "--font-space-mono",
    subsets: ["latin"],
    weight: ["400", "700"],
});
export default function Layout({ children }: {
    children: ReactNode;
}) {
    return (<div className={`${shrikhand.variable} ${nunito.variable} ${spaceMono.variable}`} style={{
            backgroundColor: "#ffffff",
            color: "#111111",
            fontFamily: "var(--font-nunito), system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 17,
            lineHeight: 1.5,
            WebkitFontSmoothing: "antialiased",
        }}>
      {children}
    </div>);
}
