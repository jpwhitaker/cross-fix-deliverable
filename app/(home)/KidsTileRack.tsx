"use client";
import { useState } from "react";
import { PALETTE, TILE_COLORS, LETTER_VALUES } from "./kids-constants";
export function KidTile({ letter, value, size = 64, color = PALETTE.cream, rotate = 0 }: {
    letter: string;
    value?: number;
    size?: number;
    color?: string;
    rotate?: number;
}) {
    return (<div style={{
            width: size, height: size,
            backgroundColor: color,
            color: "#111",
            border: "3px solid #111",
            borderRadius: Math.round(size * 0.16),
            boxShadow: "4px 4px 0 #111",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            fontFamily: "var(--font-nunito), sans-serif",
            fontWeight: 900,
            fontSize: Math.round(size * 0.52),
            lineHeight: 1,
            letterSpacing: "-0.03em",
            flex: "0 0 auto",
            transform: `rotate(${rotate}deg)`,
        }}>
      <span style={{ transform: "translateY(-3%)" }}>{letter}</span>
      {value !== undefined && value > 0 && (<div style={{
                position: "absolute",
                bottom: Math.round(size * 0.09),
                left: 0, right: 0,
                display: "flex",
                justifyContent: "center",
                gap: Math.max(1, Math.round(size * 0.04)),
            }}>
          {Array.from({ length: value }).map((_, i) => (<div key={i} style={{
                    width: Math.round(size * 0.1),
                    height: Math.round(size * 0.1),
                    borderRadius: "50%",
                    backgroundColor: "#111",
                }}/>))}
        </div>)}
    </div>);
}
export function KidsTileRack({ initial = "CROSSFIX", size = 64 }: {
    initial?: string;
    size?: number;
}) {
    const [tiles, setTiles] = useState(() => initial.split("").map((c, i) => ({ id: `${i}-${c}-${Math.random()}`, letter: c })));
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const onDragStart = (i: number) => (e: React.DragEvent) => {
        setDragIdx(i);
        try {
            e.dataTransfer.setData("text/plain", String(i));
        }
        catch { }
        e.dataTransfer.effectAllowed = "move";
    };
    const onDragOver = (i: number) => (e: React.DragEvent) => { e.preventDefault(); setOverIdx(i); };
    const onDrop = (i: number) => (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === i)
            return;
        const next = tiles.slice();
        const [m] = next.splice(dragIdx, 1);
        next.splice(i, 0, m);
        setTiles(next);
        setDragIdx(null);
        setOverIdx(null);
    };
    const shuffle = () => {
        const next = tiles.slice();
        for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
        }
        setTiles(next);
    };
    const word = tiles.map((t) => t.letter).join("");
    const score = tiles.reduce((s, t) => s + (LETTER_VALUES[t.letter] || 0), 0);
    return (<div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {tiles.map((t, i) => (<div key={t.id} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDrop={onDrop(i)} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }} style={{
                cursor: "grab",
                transform: overIdx === i && dragIdx !== null && dragIdx !== i
                    ? "translateY(-8px) rotate(-3deg)" : "none",
                opacity: dragIdx === i ? 0.35 : 1,
                transition: "transform .15s ease, opacity .15s ease",
            }}>
            <KidTile letter={t.letter} value={LETTER_VALUES[t.letter]} size={size} color={TILE_COLORS[i % TILE_COLORS.length]} rotate={(i % 2 === 0 ? -1 : 1) * 1.5}/>
          </div>))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="k-chip dark">{word} · {score} pts</span>
        <span className="k-chip">Drag to reorder</span>
        <button onClick={shuffle} className="k-btn ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
          Shuffle
        </button>
      </div>
    </div>);
}
