"use client";

import { useState } from "react";
import { RegularTileFace } from "@/components/RegularTileFace";
import { FlipTile } from "@/components/SpringTile";
import type { Letter, SwitchSide } from "@/lib/tiles";
const TILE_THEME = {
  "--e-tile-bg": "#ffffff",
  "--e-tile-border": "1.5px solid #111",
  "--e-tile-chin": "#111",
  "--e-tile-chin-valid": "#111",
  "--e-tile-letter-color": "#111",
  "--e-tile-letter-valid-color": "#111",
  "--e-pick-tile-bg": "#38bdf8",
  "--e-pick-tile-border": "1.5px solid #111",
  "--e-pick-tile-inset": "transparent",
  "--e-pick-tile-chin": "#111",
  "--e-pick-tile-chin-valid": "#111",
  "--e-pick-tile-letter-color": "#fff",
  "--e-gloss": "none",
  "--e-lip-color": "#111",
  "--e-lip-color-valid": "#111",
  "--e-pick-dots-bottom": "5px",
} as React.CSSProperties;

export function RTile({
  letter,
  value = 0,
  size = 56,
  small = false,
  isPickTile = false,
  wildcard = false,
  hint = false,
  dots = true,
  valid = false,
}: {
  letter: string;
  value?: number;
  size?: number;
  small?: boolean;
  isPickTile?: boolean;
  wildcard?: boolean;
  hint?: boolean;
  dots?: boolean;
  valid?: boolean;
}) {
  return (
    <div style={{ ...TILE_THEME, width: size, height: size, position: "relative", flex: "0 0 auto" }}>
      <RegularTileFace
        letter={letter}
        value={value}
        isPickTile={isPickTile}
        small={small}
        isWildcard={wildcard}
        wildcardHint={hint}
        inValidWord={valid}
        showDots={dots}
        fontSize={Math.round(size * (small ? 0.36 : 0.46))}
      />
    </div>
  );
}

export function RSwitchTile({
  a,
  va,
  b,
  vb,
  size = 56,
}: {
  a: string;
  va: number;
  b: string;
  vb: number;
  size?: number;
}) {
  const [side, setSide] = useState<SwitchSide>("A");
  return (
    <div style={{ ...TILE_THEME, width: size, height: size, position: "relative", flex: "0 0 auto", cursor: "pointer" }}>
      <FlipTile
        data={{ sideA: { letter: a as Letter, value: va }, sideB: { letter: b as Letter, value: vb } }}
        activeSide={side}
        onRotate={() => setSide((s) => (s === "A" ? "B" : "A"))}
        showDots
        fontSize={Math.round(size * 0.42)}
        fullSize
      />
    </div>
  );
}
