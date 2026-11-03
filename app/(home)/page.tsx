import Image from "next/image";
import Link from "next/link";
import { KidTile } from "./KidsTileRack";
import { PALETTE, LETTER_VALUES } from "./kids-constants";
import { SurfboardLogo } from "./SurfboardLogo";
function Burst({ color, size, rotate }: {
    color: string;
    size: number;
    rotate: number;
}) {
    const pts = 12, outer = size / 2 - 3, inner = outer * 0.65, cx = size / 2, cy = size / 2;
    const path: string[] = [];
    for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI * 2 * i) / (pts * 2) - Math.PI / 2;
        path.push(`${i === 0 ? "M" : "L"} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`);
    }
    path.push("Z");
    return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${rotate}deg)`, display: "block" }}>
      <path d={path.join(" ")} fill={color} stroke="#111" strokeWidth="3" strokeLinejoin="round"/>
    </svg>);
}
function Waves({ color }: {
    color: string;
}) {
    const top = "M0 20 Q 75 0, 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20";
    return (<svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="w-full h-8 sm:h-16 block -mb-px">
      <path d={`${top} L 1200 50 L 0 50 Z`} fill={color} stroke="none"/>
      <path d={top} fill="none" stroke="#111" strokeWidth="3"/>
      <rect x="0" y="37" width="1200" height="13" fill={color}/>
    </svg>);
}
function Squiggle({ color, width, height }: {
    color: string;
    width: number;
    height: number;
}) {
    return (<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible" style={{ display: "block" }}>
      <path d={`M 2 ${height - 4} Q ${width * 0.15} 2, ${width * 0.3} ${height - 4} T ${width * 0.6} ${height - 4} T ${width * 0.9} ${height - 4}`} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>);
}
function Nav() {
    return (<nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0" }}>
      <div className="hidden sm:flex" style={{ alignItems: "center", gap: 14 }}>
        <div style={{
            width: 44, height: 44, backgroundColor: PALETTE.orange,
            border: "3px solid #111", borderRadius: 10,
            boxShadow: "3px 3px 0 #111", display: "grid", placeItems: "center",
            fontFamily: "var(--font-shrikhand), sans-serif", fontSize: 26,
            color: "#111", transform: "rotate(-6deg)",
        }}>C</div>
        <span className="k-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>CROSS-FIX</span>
      </div>
      <div className="flex sm:ml-0 ml-auto" style={{ alignItems: "center", gap: 24 }}>
        <a href="#modes" className="hidden sm:block" style={{ fontWeight: 800, fontSize: 15, color: "#111" }}>Games</a>
        <a href="#rules" className="hidden sm:block" style={{ fontWeight: 800, fontSize: 15, color: "#111" }}>How to play</a>
      </div>
    </nav>);
}
function KeikiVis() {
    const tiles: [
        string,
        string
    ][] = [
        ["C", PALETTE.white], ["A", PALETTE.sky], ["T", PALETTE.white],
    ];
    return (<div style={{ display: "flex", gap: 8 }}>
      {tiles.map(([l, c], i) => (<KidTile key={l} letter={l} value={LETTER_VALUES[l]} size={52} color={c} rotate={[-4, 2, -3][i]}/>))}
    </div>);
}
function CrossVis() {
    const pattern: Record<string, {
        letter: string;
        blue?: boolean;
        double?: boolean;
    }> = {
        "2,0": { letter: "S" }, "2,1": { letter: "U" }, "2,2": { letter: "R" },
        "2,3": { letter: "F" }, "2,4": { letter: "B" }, "2,5": { letter: "O", blue: true },
        "2,6": { letter: "A" }, "2,7": { letter: "R" }, "2,8": { letter: "D" }, "2,9": { letter: "S" },
        "0,5": { letter: "B" }, "1,5": { letter: "R" },
        "3,5": { letter: "TH", double: true }, "4,5": { letter: "E" }, "5,5": { letter: "R" },
    };
    const ROWS = 6, COLS = 10;
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const entry = pattern[`${r},${c}`];
            cells.push(<div key={`${r}-${c}`} style={{
                    aspectRatio: "1",
                    backgroundColor: entry
                        ? (entry.blue ? PALETTE.sky : PALETTE.white)
                        : "transparent",
                    border: entry ? "2px solid #111" : "1.5px dashed rgba(0,0,0,0.12)",
                    borderRadius: "16%", display: "grid", placeItems: "center",
                    fontFamily: "var(--font-nunito), sans-serif",
                    fontWeight: 900, fontSize: entry?.double ? "0.45em" : "0.6em", color: "#111",
                    boxShadow: entry ? "2px 2px 0 #111" : "none",
                }}>{entry?.letter ?? ""}</div>);
        }
    }
    return (<div style={{ width: "100%", display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 3 }}>
      {cells}
    </div>);
}
function SurfFixVis() {
    const segColor = { pre: PALETTE.white, para: PALETTE.white, tion: PALETTE.white };
    const pattern: Record<string, {
        letter: string;
        seg: keyof typeof segColor;
    }> = {
        "0,0": { letter: "P", seg: "pre" }, "0,1": { letter: "R", seg: "pre" }, "0,2": { letter: "E", seg: "pre" },
        "1,2": { letter: "P", seg: "para" }, "2,2": { letter: "A", seg: "para" },
        "3,2": { letter: "R", seg: "para" }, "4,2": { letter: "A", seg: "para" },
        "4,3": { letter: "T", seg: "tion" }, "4,4": { letter: "I", seg: "tion" },
        "4,5": { letter: "O", seg: "tion" }, "4,6": { letter: "N", seg: "tion" },
    };
    const ROWS = 5, COLS = 7;
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const entry = pattern[`${r},${c}`];
            cells.push(<div key={`${r}-${c}`} style={{
                    aspectRatio: "1",
                    backgroundColor: entry ? segColor[entry.seg] : "transparent",
                    border: entry ? "2px solid #111" : "1.5px dashed rgba(0,0,0,0.12)",
                    borderRadius: "22%", display: "grid", placeItems: "center",
                    fontFamily: "var(--font-nunito), sans-serif",
                    fontWeight: 900, fontSize: "1em", color: "#111",
                    boxShadow: entry ? "2px 2px 0 #111" : "none",
                }}>{entry?.letter ?? ""}</div>);
        }
    }
    return (<div style={{ width: "100%", display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 3 }}>
      {cells}
    </div>);
}
function ModeCard({ number, name, say, tagline, what, time, players, bg, numberColor, rotate = 0, compact = false, playHref, children }: {
    number: string;
    name: string;
    say: string;
    tagline: string;
    what: string;
    time: string;
    players: string;
    bg: string;
    numberColor: string;
    rotate?: number;
    compact?: boolean;
    playHref?: string;
    children: React.ReactNode;
}) {
    if (compact) {
        return (<div className="k-card hover-lift" style={{ backgroundColor: bg, padding: "20px 16px 108px", transform: `rotate(${rotate}deg)`, position: "relative", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 10 }}>
          <div className="k-display" style={{
                fontSize: 64, lineHeight: 0.85, color: numberColor,
                WebkitTextStroke: "2px #111", textShadow: "3px 3px 0 #111", marginBottom: 4,
            }}>{number}</div>
          <h3 className="k-display" style={{ margin: 0, fontSize: 28, lineHeight: 1, color: "#111" }}>{name}</h3>
          <div className="k-mono" style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginTop: 3, color: "#111" }}>{say}</div>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800, lineHeight: 1.25, color: "#111" }}>{tagline}</p>
        {what && <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: "#111", opacity: 0.85 }}>{what}</p>}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
        {playHref && (<a href={playHref} style={{
                    position: "absolute",
                    left: 16,
                    bottom: 54,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px solid #111",
                    borderRadius: 999,
                    boxShadow: "4px 4px 0 #111",
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#111",
                    backgroundColor: "transparent",
                    textDecoration: "none",
                }}>
            Play for Free →
          </a>)}
        <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="k-chip dark" style={{ fontSize: 11, padding: "3px 8px" }}>⏱ {time}</span>
          <span className="k-chip" style={{ fontSize: 11, padding: "3px 8px" }}>👥 {players}</span>
        </div>
      </div>);
    }
    return (<div className="k-card hover-lift" style={{ backgroundColor: bg, padding: "32px 32px 28px", transform: `rotate(${rotate}deg)` }}>
      <div style={{ marginBottom: 18 }}>
        <div className="k-display" style={{
            fontSize: 120, lineHeight: 0.85, color: numberColor,
            WebkitTextStroke: "3px #111", textShadow: "5px 5px 0 #111", marginBottom: 4,
        }}>{number}</div>
        <h3 className="k-display" style={{ margin: 0, fontSize: 48, lineHeight: 1, color: "#111" }}>{name}</h3>
        <div className="k-mono" style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginTop: 4, color: "#111" }}>{say}</div>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: "#111" }}>{tagline}</p>
      <p style={{ margin: "0 0 22px", fontSize: 15, fontWeight: 600, lineHeight: 1.55, color: "#111", opacity: 0.85 }}>{what}</p>
      <div style={{ minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0 10px" }}>
        {children}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "3px solid #111", paddingTop: 14, marginTop: 8 }}>
        <span className="k-chip dark">⏱ {time}</span>
        <span className="k-chip">👥 {players}</span>
      </div>
    </div>);
}
export default function HomepageRedesign6() {
    return (<>

      <section style={{ position: "relative", overflow: "hidden" }}>

        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <Image src="/surfers-painting.jpeg" alt="" fill priority className="object-cover object-center"/>
        </div>

        <div className="k-page" style={{ position: "relative", zIndex: 1 }}>
          <Nav />

          <div style={{ padding: "100px 0 120px", maxWidth: 640 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
              <span className="k-chip dark">A word tile game</span>
              <span className="k-chip">Ages 8+</span>
              <span className="k-chip">1–4 players</span>
            </div>

            <div className="sm:hidden">
              <SurfboardLogo width={310}/>
            </div>
            <div className="hidden sm:block">
              <SurfboardLogo width={540}/>
            </div>

            <div style={{ marginTop: 32, paddingTop: 4 }}>
              <Squiggle color={PALETTE.orange} width={280} height={14}/>
            </div>

            <div style={{ position: "relative", marginTop: 24, maxWidth: 520 }}>
              <div style={{
            position: "absolute", inset: "-50px -200px -50px -240px",
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
        }}/>
              <p style={{ position: "relative", fontSize: 22, fontWeight: 700, lineHeight: 1.35, margin: 0, color: "#111" }}>
                A{" "}
                <span style={{
            backgroundColor: PALETTE.cream, padding: "0 6px",
            border: "2.5px solid #111", borderRadius: 6,
            boxShadow: "3px 3px 0 #111", display: "inline-block", transform: "rotate(-1deg)",
        }}>tile-based word game</span>{" "}
                with <em>three game styles.</em>
              </p>
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
              <a href="#modes" className="k-btn primary">Check out the Games →</a>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <Waves color={PALETTE.sky}/>
        </div>
      </section>


      <section id="modes" style={{ backgroundColor: PALETTE.sky, padding: "60px 0 0", overflow: "hidden", marginTop: -2 }}>
        <div className="k-page">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 className="k-display" style={{ margin: "0 0 8px", fontSize: "clamp(28px, 3.5vw, 48px)", lineHeight: 1.1 }}>
              <span style={{ color: "#006e86" }}>3 Tile-Based Word Games</span>
              <br />
              <span style={{ color: "#fff" }}>with Increasing Difficulty</span>
            </h2>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span className="k-mono" style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Keiki</span>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20 }}>
                {([6, 12, 20] as const).map((h, i) => (<div key={i} style={{
                width: 14, height: h,
                backgroundColor: [PALETTE.white, PALETTE.green, PALETTE.orange, PALETTE.rust][i],
                border: "2px solid #111", borderRadius: 2,
            }}/>))}
              </div>
              <span className="k-mono" style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Surf-Fix</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModeCard compact number="1" name="Keiki Play" say="" tagline="Simple word formation for English learners." what="Draw 4 vowels, 5 consonants, and 1 pick tile. Write your longest word — unused tiles carry forward. 12 rounds total." time="10–20 min" players="1–4" playHref="/keiki-play" bg={PALETTE.white} numberColor={PALETTE.orange} rotate={-1}><KeikiVis /></ModeCard>

            <ModeCard compact number="2" name="Cross Fix" say="" tagline="More complex game with moving words, crossing words, and side-by-side words." what="A fixed S anchors the center. Cross words, extend them with a Pick tile, or move them around. Score length points for 7+ letter words." time="90 min" players="1–4" playHref="/crosswords" bg={PALETTE.green} numberColor={PALETTE.rust} rotate={0.7}><CrossVis /></ModeCard>

            <ModeCard compact number="3" name="Surf-Fix" say="" tagline="Bending words and reusing tiles in the Surfing Maneuvers." what="Creating long words in a convoluted word configuration requiring knowledge and focus, as well as challenging the players creativity and memory, a true brain workout." time="90 min" players="1–4" playHref="/surf-fix" bg={PALETTE.orange} numberColor={PALETTE.white} rotate={-0.7}><SurfFixVis /></ModeCard>
          </div>

          <div style={{ margin: "80px auto 80px", textAlign: "center" }}>

            <Image src="/hawaii-islands.svg" width={1000} height={645} unoptimized alt="Hawaiian islands" style={{ width: "64%", height: "auto", maxWidth: 448, display: "block", margin: "0 auto", filter: "brightness(0) invert(1)", opacity: 0.85 }}/>
          </div>
        </div>
      </section>


      <section id="rules" style={{ padding: "100px 0", backgroundColor: "#fff", borderTop: "3px solid #111" }}>
        <div className="k-page">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span className="k-chip dark" style={{ marginBottom: 16, display: "inline-block" }}>How to play</span>
            <h2 className="k-display" style={{ fontSize: "clamp(44px, 6vw, 80px)", lineHeight: 1, margin: "10px 0 0" }}>
              Easy to catch. Hard to master.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
            { n: 1, title: "Pick a mode", color: PALETTE.sky },
            { n: 2, title: "Draw your tiles", color: PALETTE.cream },
            { n: 3, title: "Make big words", color: PALETTE.orange },
            { n: 4, title: "Start carving", color: PALETTE.green },
        ].map((s, i) => (<div key={s.n} className="k-card hover-lift" style={{
                padding: "24px 22px", backgroundColor: s.color,
                transform: `rotate(${(i - 1.5) * 0.8}deg)`,
            }}>
                <div className="k-display" style={{
                fontSize: 72, lineHeight: 0.9, color: "#fff",
                WebkitTextStroke: "3px #111", textShadow: "4px 4px 0 #111", marginBottom: 8,
            }}>{s.n}</div>
                <h4 className="k-display" style={{ margin: "6px 0 0", fontSize: 26, lineHeight: 1, color: "#111" }}>{s.title}</h4>
              </div>))}
          </div>
          <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end" }}>
            <Link href="/rules" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              border: "3px solid #111", borderRadius: 999, boxShadow: "4px 4px 0 #111",
              padding: "13px 28px", fontSize: 16, fontWeight: 900, color: "#111",
              backgroundColor: PALETTE.cream, textDecoration: "none",
            }}>View Rulebook →</Link>
          </div>
        </div>
      </section>


      <section style={{ backgroundColor: PALETTE.orange, borderTop: "3px solid #111", padding: "100px 0 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 40, left: "6%", pointerEvents: "none" }}>
          <Burst color={PALETTE.cream} size={90} rotate={-12}/>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: "8%", pointerEvents: "none" }}>
          <Burst color={PALETTE.teal} size={120} rotate={24}/>
        </div>
        <div className="k-page" style={{ position: "relative", textAlign: "center" }}>
          <h2 className="k-display" style={{
            margin: 0, fontSize: "clamp(72px, 12vw, 180px)", lineHeight: 0.9,
            color: "#fff", WebkitTextStroke: "3px #111", textShadow: "8px 8px 0 #111",
        }}>Let&apos;s play!</h2>
          <p style={{ fontSize: 22, fontWeight: 800, maxWidth: 520, margin: "28px auto 36px", lineHeight: 1.35, color: "#111" }}>
            Free to play in any browser. No download, no account. Just tiles.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#modes" className="k-btn" style={{
            backgroundColor: "#fff", border: "3px solid #111",
            boxShadow: "4px 4px 0 #111", padding: "18px 28px", fontSize: 17, color: "#111",
        }}>Start playing — it&apos;s free →</a>
            <a href="#modes" className="k-btn secondary" style={{ padding: "18px 28px", fontSize: 17 }}>See all games</a>
          </div>
          <div className="k-mono" style={{ marginTop: 30, fontSize: 13, fontWeight: 700, opacity: 0.75, color: "#111" }}>
            FREE · ALL DEVICES · AGES 8+
          </div>
          <div style={{ marginTop: 48, display: "flex", justifyContent: "center" }}>

            <Image src="/flag.svg" unoptimized alt="Flag of Hawaiʻi" width={180} height={90} style={{ border: "3px solid #111", borderRadius: 6, boxShadow: "5px 5px 0 #111", display: "block" }}/>
          </div>
        </div>
      </section>


      <footer style={{ padding: "50px 0 40px", backgroundColor: "#111", color: "#fff" }}>
        <div className="k-page" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
            width: 44, height: 44, backgroundColor: PALETTE.orange,
            border: "3px solid #fff", borderRadius: 10,
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-shrikhand), sans-serif", fontSize: 26,
            transform: "rotate(-6deg)", color: "#111",
        }}>C</div>
            <span className="k-mono" style={{ fontSize: 13, fontWeight: 700 }}>CROSS-FIX · OAHU, HI</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontWeight: 700, fontSize: 14 }}>
            <a href="#modes" style={{ color: "#fff" }}>Games</a>
            <a href="#rules" style={{ color: "#fff" }}>How to play</a>
            <a href="/keiki-play" style={{ color: "#fff" }}>Play for Free →</a>
          </div>
          <div className="k-mono" style={{ fontSize: 16, opacity: 0.6 }}>© 2026</div>
        </div>
      </footer>
    </>);
}
