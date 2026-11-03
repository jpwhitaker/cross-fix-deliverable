"use client";
import SurfboardSVG from "@/public/surf-board5.svg";
const TILE_BG = "#38bdf8";
const LETTER_COLOR = "#ffffff";
const TITLE = "CROSS-FIX".split("");
const BASE_WIDTH = 540;
export function SurfboardLogo({ width = BASE_WIDTH }: {
    width?: number;
}) {
    const s = width / BASE_WIDTH;
    const offsetX = -12, offsetY = 66, gap = 2;
    const tile = Math.round(44 * s);
    const fontSize = Math.round(26 * s);
    const height = Math.round(160 * s);
    return (<>

    <div style={{ position: "relative", width, height }}>
      <SurfboardSVG style={{
            width,
            position: "absolute",
            top: Math.round(4 * s),
            left: "50%",
            transform: "translateX(-50%) scaleY(0.82)",
            transformOrigin: "center",
            maxWidth: "none",
            filter: "drop-shadow(4px 0 0 #006e86) drop-shadow(-4px 0 0 #006e86) drop-shadow(0 4px 0 #006e86) drop-shadow(0 -4px 0 #006e86) drop-shadow(0 6px 12px rgba(0,0,0,0.3))",
        }}/>
      <div style={{
            position: "absolute",
            top: Math.round(offsetY * s),
            left: "50%",
            transform: `translateX(calc(-50% + ${Math.round(offsetX * s)}px))`,
            display: "flex",
            gap: Math.round(gap * s),
            zIndex: 10,
        }}>
        {TITLE.map((letter, i) => (<div key={i} style={{
                width: tile, height: tile,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: `${Math.round(8 * s)}px`,
                border: `${Math.max(1, Math.round(1.5 * s))}px solid #111`,
                background: TILE_BG,
                boxShadow: `0 ${Math.round(4 * s)}px 0 #111`,
            }}>
            <span style={{
                fontFamily: "var(--font-nunito), sans-serif",
                fontWeight: 900, fontSize, color: LETTER_COLOR,
                lineHeight: 1, paddingTop: Math.round(2 * s),
                letterSpacing: letter === "-" ? 0 : "0.02em",
            }}>{letter}</span>
          </div>))}
      </div>
    </div>
    </>);
}
