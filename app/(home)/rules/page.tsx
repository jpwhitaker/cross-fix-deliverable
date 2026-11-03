import type { Metadata } from "next";
import Link from "next/link";
import { PALETTE } from "../kids-constants";
import { RTile, RSwitchTile } from "./RulesTiles";

export const metadata: Metadata = {
  title: "Rulebook | CROSS-FIX",
  description:
    "How to play CROSS-FIX — the full rulebook for Keiki Play, Cross Fix, and Surf-Fix.",
};

function Band({
  id,
  bg = "#fff",
  border = true,
  children,
}: {
  id?: string;
  bg?: string;
  border?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        backgroundColor: bg,
        borderTop: border ? "3px solid #111" : undefined,
        padding: "72px 0",
      }}
    >
      <div className="k-page">{children}</div>
    </section>
  );
}

function Head({ kicker, title, dark = false }: { kicker: string; title: string; dark?: boolean }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <span className={`k-chip ${dark ? "" : "dark"}`}>{kicker}</span>
      <h2
        className="k-display"
        style={{
          margin: "16px 0 0",
          fontSize: "clamp(34px, 5vw, 60px)",
          lineHeight: 1,
          color: dark ? "#fff" : "#111",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function Card({
  bg = "#fff",
  rotate = 0,
  children,
  style,
}: {
  bg?: string;
  rotate?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="k-card"
      style={{ backgroundColor: bg, padding: "26px 26px", transform: `rotate(${rotate}deg)`, ...style }}
    >
      {children}
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="k-display" style={{ margin: "0 0 10px", fontSize: 26, lineHeight: 1.05, color: "#111" }}>
      {children}
    </h3>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, lineHeight: 1.55, color: "#111", ...style }}>
      {children}
    </p>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 8px", paddingLeft: 22 }}>
      {items.map((it, i) => (
        <li key={i} style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.55, color: "#111", marginBottom: 8 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

type GCell = { letter?: string; valid?: boolean; open?: boolean };
function Grid({
  rows,
  cols,
  cells,
  cell = 34,
  label,
}: {
  rows: number;
  cols: number;
  cells: Record<string, GCell>;
  cell?: number;
  label?: string;
}) {
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = cells[`${r},${c}`];
      out.push(
        e?.letter ? (
          <RTile key={`${r}-${c}`} letter={e.letter} size={cell} dots={false} valid={e.valid} />
        ) : (
          <div
            key={`${r}-${c}`}
            style={{
              width: cell,
              height: cell,
              border: e?.open ? "2px dashed #111" : "1.5px dashed rgba(0,0,0,0.12)",
              borderRadius: "20%",
              display: "grid",
              placeItems: "center",
            }}
          >
            {e?.open ? <span style={{ fontSize: cell * 0.6, opacity: 0.6, lineHeight: 1, color: "#111", fontWeight: 700 }}>@</span> : ""}
          </div>
        )
      );
    }
  }
  const gridWidth = cols * cell + Math.max(0, cols - 1) * 3;
  return (
    <div style={{ margin: "6px 0 14px" }}>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ width: gridWidth, maxWidth: "100%", margin: "0 auto" }}>
          {label && (
            <div className="k-mono" style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 8, color: "#111", textAlign: "left" }}>
              {label}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap: 3, width: "max-content" }}>
          {out}
          </div>
        </div>
      </div>
    </div>
  );
}

function Note({ children, bg = PALETTE.cream }: { children: React.ReactNode; bg?: string }) {
  return (
    <div
      style={{
        borderLeft: "6px solid #111",
        background: bg,
        borderRadius: "0 12px 12px 0",
        padding: "14px 18px",
        margin: "24px 0 14px",
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1.5,
        color: "#111",
      }}
    >
      {children}
    </div>
  );
}

function TileChip({ label, sub, bg = "#fff" }: { label: string; sub?: string; bg?: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 54,
        padding: "8px 10px",
        background: bg,
        border: "2.5px solid #111",
        borderRadius: 12,
        boxShadow: "3px 3px 0 #111",
      }}
    >
      <span style={{ fontFamily: "var(--font-nunito), sans-serif", fontWeight: 900, fontSize: 18, color: "#111" }}>
        {label}
      </span>
      {sub && (
        <span className="k-mono" style={{ fontSize: 10, fontWeight: 700, color: "#111", opacity: 0.8 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export default function RulebookPage() {
  return (
    <>
      <div style={{ backgroundColor: "#fff" }}>
        <div className="k-page" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0" }}>
          <Link href="/" className="k-mono" style={{ fontSize: 13, fontWeight: 700, color: "#111", display: "inline-flex", alignItems: "center", gap: 8 }}>
            ← CROSS-FIX
          </Link>
          <Link href="/#modes" className="k-btn" style={{ padding: "10px 18px", fontSize: 14, background: PALETTE.orange, color: "#111" }}>
            Check out the Games →
          </Link>
        </div>
      </div>

      <section style={{ backgroundColor: PALETTE.orange, borderTop: "3px solid #111", padding: "72px 0 64px" }}>
        <div className="k-page">
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <span className="k-chip dark">3 games</span>
            <span className="k-chip">1–4 players</span>
            <span className="k-chip">~90 min</span>
            <span className="k-chip">Ages 8+</span>
          </div>
          <h1
            className="k-display"
            style={{
              margin: 0,
              fontSize: "clamp(56px, 11vw, 140px)",
              lineHeight: 0.88,
              color: "#fff",
              WebkitTextStroke: "3px #111",
              textShadow: "7px 7px 0 #111",
            }}
          >
            The Rulebook
          </h1>
          <p style={{ maxWidth: 640, marginTop: 26, fontSize: 19, fontWeight: 700, lineHeight: 1.45, color: "#111" }}>
            Three word games born on the Island of Oahu. The rules of each game{" "}
            <strong>carry forward into the next</strong>, gradually raising the difficulty — from simple
            keiki words all the way to bending words and carving the board like a surfer.
          </p>
        </div>
      </section>

      <Band bg="#fff" id="games">
        <Head kicker="The progression" title="Three Games, One Wave" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { n: "1", name: "Keiki Play", color: PALETTE.sky, blurb: "Simple word formation for English learners. (Keiki is Hawaiian for child.)" },
            { n: "2", name: "Cross Fix", color: PALETTE.green, blurb: "Words crossing each other, moving words around, and side-by-side words." },
            { n: "3", name: "Surf-Fix", color: PALETTE.orange, blurb: "Bending words in the Surfing Maneuvers and reusing tiles is added." },
          ].map((g, i) => (
            <Card key={g.n} bg={g.color} rotate={(i - 1) * 0.7} style={{ display: "flex", flexDirection: "column" }}>
              <div className="k-display" style={{ fontSize: 64, lineHeight: 0.85, color: "#fff", WebkitTextStroke: "2.5px #111", textShadow: "4px 4px 0 #111" }}>
                {g.n}
              </div>
              <SubHead>{g.name}</SubHead>
              <P style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{g.blurb}</P>
            </Card>
          ))}
        </div>
        <Note>
          <strong>No dictionary needed.</strong> Every word you play is checked instantly against the game&apos;s built-in
          word list — valid words score, invalid ones are flagged right on the board.
        </Note>
      </Band>

      <Band bg={PALETTE.sky}>
        <Head kicker="The tiles" title="What You Play With" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SubHead>Regular letter tiles</SubHead>
            <Bullets
              items={[
                <>Each round deals from two pools.</>,
                <><strong>Vowels (50):</strong> A, E, I, O, U, Y plus switch tiles.</>,
                <><strong>Consonants (60):</strong> the rest of the alphabet plus switch tiles.</>,
                <>Every regular tile shows its <strong>point value</strong>.</>,
                <><strong>Pick tiles (80)</strong> can be any letter, so use them to save your regular tiles.</>,
                <><strong>Backup tiles</strong> automatically join in if you run low on vowels or consonants.</>,
              ]}
            />
          </Card>
          <Card>
            <SubHead>Double letter tiles</SubHead>
            <P>One each — they count as <strong>two letters</strong> for length.</P>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <RTile letter="CH" value={5} small size={64} />
              <RTile letter="PH" value={5} small size={64} />
              <RTile letter="SH" value={4} small size={64} />
              <RTile letter="TH" value={4} small size={64} />
              <RTile letter="CK" value={5} small size={64} />
            </div>
          </Card>
          <Card style={{ gridColumn: "1 / -1" }}>
            <SubHead>Switch letters</SubHead>
            <P>Tap a switch tile to flip it between its two letters (each with its own value):</P>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              <RSwitchTile a="A" va={1} b="Y" vb={3} size={64} />
              <RSwitchTile a="I" va={1} b="J" vb={4} size={64} />
              <RSwitchTile a="M" va={2} b="W" vb={3} size={64} />
              <RSwitchTile a="O" va={1} b="Q" vb={5} size={64} />
              <RSwitchTile a="N" va={1} b="Z" vb={5} size={64} />
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <RTile letter="X" value={4} hint size={64} />
                <span className="k-mono" style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>WILD · ANY LETTER</span>
              </div>
            </div>
            <Note bg={PALETTE.white}>
              <strong>Exchanging:</strong> if a switch letter is on the board as one of its letters and you later draw that
              exact letter, you can swap it out and reuse the switch tile — keeping the word intact. <strong>X</strong> is the
              wild one: it can be any letter, but can only be taken back <strong>once</strong>, and only as an X that same round.
            </Note>
          </Card>
        </div>
      </Band>

      <Band bg="#fff">
        <Head kicker="Game 1" title="Keiki Play" />
        <Card bg={PALETTE.sky}>
          <P>
            Start each round with <strong>4 vowels, 5 consonants, and 1 pick tile.</strong> Write the longest word you can —
            <strong> unused tiles transfer to the next round.</strong>
          </P>
          <Bullets
            items={[
              <>Write words <strong>horizontally to the right</strong> or <strong>vertically down</strong>.</>,
              <>You don&apos;t have to attach your word to anything else on the board.</>,
              <>Write <strong>12 words</strong> total — each one is checked and scored for you automatically.</>,
            ]}
          />
        </Card>
      </Band>

      <Band bg={PALETTE.green}>
        <Head kicker="Game 2" title="Cross Fix" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SubHead>The board &amp; the Ride</SubHead>
            <Bullets
              items={[
                <>A fixed <strong>Center S</strong> anchors the middle. It never moves, but it can be used in a word.</>,
                <>Start each round with <strong>4 vowels, 5 consonants</strong>, and <strong>1 pick tile</strong> in rounds 1-12 or <strong>3 pick tiles</strong> in rounds 13-16.</>,
                <>The word you write each round is your <strong>&ldquo;Ride.&rdquo;</strong></>,
                <>Your Ride can <strong>cross</strong> an existing word, <strong>add onto</strong> one with a new pick tile, or be a <strong>free-standing (FS)</strong> word anywhere.</>,
                <>You may move an unattached FS word and then use its letters, but only <strong>one FS word per Ride</strong>.</>,
              ]}
            />
          </Card>
          <Card>
            <SubHead>Acceptable words</SubHead>
            <Bullets
              items={[
                <>Any real word the <strong>built-in dictionary</strong> recognizes (any word class).</>,
                <>Any pair on the <strong>2-letter SBS list</strong> (below).</>,
                <>3+ letter abbreviations (PHD, ATM, SOS) and British spellings are included too.</>,
                <><strong>Hyphenated words</strong> via a surfboard tile — and you may bend the word at the hyphen.</>,
              ]}
            />
            <Note bg={PALETTE.cream}>
              <strong>No symbols. No names</strong> (biographical or geographical) — unless you inflect them into a real word:
              HAWAII → <strong>HAWAIIAN</strong>, LONDON → <strong>LONDONER</strong>.
            </Note>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: 20 }}>
          <Card>
            <SubHead>Length points</SubHead>
            <P>Awarded only for your Ride, only at <strong>7+ letters</strong> (no hyphens; doubles count as two). Most of your score lives here.</P>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["7", "10"], ["8", "20"], ["9", "30"], ["10", "40"], ["11", "50"], ["12", "60"]].map(([l, p]) => (
                <TileChip key={l} label={`${l}`} sub={`${p} pts`} bg={PALETTE.cream} />
              ))}
              <TileChip label="13+" sub="+10 each" bg={PALETTE.orange} />
            </div>
          </Card>
          <Card>
            <SubHead>Value points &amp; reruns</SubHead>
            <P>
              You earn the point-values of your <strong>Ride + any word you changed</strong>. (2-letter words and SBS score
              zero.) Hit <strong>800+</strong> regularly and you&apos;re ready for Surf-Fix.
            </P>
            <P style={{ marginBottom: 0, fontSize: 14 }}>
              Bad tiles? Take a <strong>rerun</strong>: <em>Ripples</em> (3+ same letters), <em>Ankle Biters</em> (4 pairs), or{" "}
              <em>Choppy Waters</em> (10+ points in high-value tiles).
            </P>
          </Card>
        </div>
      </Band>

      <Band bg="#fff">
        <Head kicker="Reference" title="2-Letter Side-by-Side List" />
        <P style={{ maxWidth: 720 }}>
          <strong>Every vowel-consonant and consonant-vowel pair is automatically accepted.</strong> These extra
          same-type pairs are accepted too:
        </P>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card bg={PALETTE.sky}>
            <SubHead>Plural S</SubHead>
            <P style={{ marginBottom: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.9 }}>
              Any consonant + S: BS, CS, DS, FS, GS, HS ... all the way down.
            </P>
          </Card>
          <Card bg={PALETTE.cream}>
            <SubHead>Same letter</SubHead>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.9, color: "#111" }}>
              BB CC DD EE FF GG LL MM NN OO PP RR SS TT ZZ
            </div>
          </Card>
          <Card bg={PALETTE.green}>
            <SubHead>Word starters</SubHead>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.9, color: "#111" }}>
              BL BR CH CL CR DR EA FL FR GL GR OU PH PL PR SC SH SK SL SM SN SP ST SW TH TR WH WR
            </div>
          </Card>
        </div>
      </Band>

      <section style={{ backgroundColor: PALETTE.orange, borderTop: "3px solid #111", padding: "72px 0" }}>
        <div className="k-page">
          <Head kicker="Game 3" title="Surf-Fix" />
          <P style={{ maxWidth: 720, fontWeight: 700 }}>
            The Cross Fix rules carry over, and two big new ideas are added: <strong>bending words</strong> and{" "}
            <strong>reusing tiles</strong> through the Surfing Maneuvers.
          </P>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: 8 }}>
            <Card>
              <SubHead>Bending words</SubHead>
              <Bullets
                items={[
                  <>Bend a word <strong>down or to the right</strong>, one or more times, as long as the word stays intact.</>,
                  <>You can bend an unattached part of a word at its <strong>start or end</strong>.</>,
                  <>Use bends to <strong>free up space</strong>, <strong>free a letter</strong>, or set up <strong>tile reuse</strong> before writing your Ride.</>,
                ]}
              />
            </Card>
            <Card>
              <SubHead>Distinguishing words</SubHead>
              <Bullets
                items={[
                  <>Every word must stay readable.</>,
                  <>Every word needs an empty <strong>pre-space</strong> and <strong>post-space</strong>, shown here as @.</>,
                ]}
              />
              <Grid rows={1} cols={8} cell={34} label="An empty space (@) before and after - its pre & post" cells={{
                "0,0": { open: true }, "0,1": { letter: "S" }, "0,2": { letter: "P" }, "0,3": { letter: "A" },
                "0,4": { letter: "C" }, "0,5": { letter: "E" }, "0,6": { letter: "R" }, "0,7": { open: true },
              }} />
              <Grid rows={4} cols={6} cell={34} label="Bend the word and the post-space moves with it" cells={{
                "0,0": { open: true }, "0,1": { letter: "S" }, "0,2": { letter: "P" }, "0,3": { letter: "A" }, "0,4": { letter: "C" },
                "1,4": { letter: "E" }, "2,4": { letter: "R" }, "3,4": { open: true },
              }} />
              <Bullets
                items={[
                  <>A pre/post space can be shared by two words, and a hyphen can act as one.</>,
                  <>A shared space can only be reused if it creates a <strong>new valid word</strong>.</>,
                  <>You can begin a new word at an existing letter by placing a new tile after it in the new direction. Its own <strong>pre-space must be empty</strong>.</>,
                  <>A bend alone does <strong>not</strong> create another word beginning. Bending SPEARFISHES at P does not also create PEARFISHES, even with an empty square above P.</>,
                  <>A new prefix can still enter that bend as a Backdoor. Once a shared word is submitted, its beginning remains established on later turns.</>,
                  <>A new prefix may enter partway into an old word, follow its shared ending, then turn into new letters at the final shared tile. The old word keeps its own ending and empty post-space.</>,
                  <>An approved SBS sequence may be submitted on its own with empty boundaries and the required Pick Tile. It needs at least two tiles; a two-letter SBS scores zero.</>,
                ]}
              />
            </Card>
          </div>
          <Note bg="#fff">
            <strong>The two pillars of Surf-Fix:</strong> (1) bending words and reusing tiles correctly, and (2) making sure
            every word — including SBS pairs — keeps an empty pre- and post-space.
          </Note>
        </div>
      </section>

      <Band bg="#fff">
        <Head kicker="Reusing tiles" title="Surfing Maneuvers" />
        <Bullets
          items={[
            <>These maneuvers <strong>reuse tiles</strong> already on the board, so you don&apos;t run out of letters or space.</>,
            <>First <strong>carve</strong> an existing word, usually just after a prefix or before a suffix.</>,
            <>Then attach new letters to the carved section.</>,
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SubHead>Down the Line</SubHead>
            <P style={{ fontSize: 14 }}>Carve a word, then write <strong>from</strong> the bending point.</P>
            <Grid rows={6} cols={13} cell={28} label="1. Start with DESTROY" cells={{
              "0,0": { open: true },
              "0,1": { letter: "D" }, "0,2": { letter: "E" }, "0,3": { letter: "S" }, "0,4": { letter: "T" },
              "0,5": { letter: "R" }, "0,6": { letter: "O" }, "0,7": { letter: "Y" },
              "0,8": { open: true },
            }} />
            <Grid rows={6} cols={13} cell={28} label="2. Carve it after DES" cells={{
              "0,0": { open: true }, "0,1": { letter: "D" }, "0,2": { letter: "E" }, "0,3": { letter: "S" },
              "1,3": { letter: "T" }, "2,3": { letter: "R" }, "3,3": { letter: "O" }, "4,3": { letter: "Y" },
              "5,3": { open: true },
            }} />
            <Grid rows={6} cols={13} cell={28} label="3. Write DESTINATION from that bend" cells={{
              "0,0": { open: true },
              "0,1": { letter: "D" }, "0,2": { letter: "E" }, "0,3": { letter: "S" }, "0,4": { letter: "T", valid: true },
              "0,5": { letter: "I", valid: true }, "0,6": { letter: "N", valid: true }, "0,7": { letter: "A", valid: true },
              "0,8": { letter: "T", valid: true }, "0,9": { letter: "I", valid: true }, "0,10": { letter: "O", valid: true },
              "0,11": { letter: "N", valid: true },
              "0,12": { open: true },
              "1,3": { letter: "T" }, "2,3": { letter: "R" }, "3,3": { letter: "O" }, "4,3": { letter: "Y" },
              "5,3": { open: true },
            }} />
          </Card>
          <Card>
            <SubHead>Backdoor</SubHead>
            <P style={{ fontSize: 14 }}>Write <strong>into</strong> a bending point — your word enters the bend.</P>
            <Grid rows={6} cols={9} cell={28} label="1. Start with SURFING" cells={{
              "0,0": { open: true },
              "0,1": { letter: "S" }, "0,2": { letter: "U" }, "0,3": { letter: "R" }, "0,4": { letter: "F" },
              "0,5": { letter: "I" }, "0,6": { letter: "N" }, "0,7": { letter: "G" },
              "0,8": { open: true },
            }} />
            <Grid rows={6} cols={9} cell={28} label="2. Bend SURFING" cells={{
              "0,0": { open: true },
              "1,0": { letter: "S" }, "2,0": { letter: "U" }, "3,0": { letter: "R" }, "4,0": { letter: "F" },
              "5,0": { letter: "I" }, "5,1": { letter: "N" }, "5,2": { letter: "G" },
              "5,3": { open: true },
            }} />
            <Grid rows={6} cols={9} cell={28} label="3. Enter the bend with WALKING" cells={{
              "0,5": { open: true },
              "1,5": { letter: "S" }, "2,5": { letter: "U" }, "3,5": { letter: "R" }, "4,5": { letter: "F" },
              "5,0": { open: true },
              "5,1": { letter: "W", valid: true }, "5,2": { letter: "A", valid: true }, "5,3": { letter: "L", valid: true },
              "5,4": { letter: "K", valid: true }, "5,5": { letter: "I" }, "5,6": { letter: "N" },
              "5,7": { letter: "G" },
              "5,8": { open: true },
            }} />
          </Card>
          <Card>
            <SubHead>Floater</SubHead>
            <P style={{ fontSize: 14 }}>
              Carve <strong>one letter off the start</strong>, then write along the top. Your Ride must reuse that letter and
              create a <strong>valid 2-letter SBS</strong>.
            </P>
            <Grid rows={9} cols={12} cell={26} label="1. Start with RESPOND" cells={{
              "0,1": { open: true },
              "1,1": { letter: "R" }, "2,1": { letter: "E" }, "3,1": { letter: "S" }, "4,1": { letter: "P" },
              "5,1": { letter: "O" }, "6,1": { letter: "N" }, "7,1": { letter: "D" },
              "8,1": { open: true },
            }} />
            <Grid rows={9} cols={12} cell={26} label="2. Carve RE off the top" cells={{
              "1,0": { open: true }, "1,1": { letter: "R" }, "1,2": { letter: "E" },
              "2,2": { letter: "S" }, "3,2": { letter: "P" }, "4,2": { letter: "O" }, "5,2": { letter: "N" },
              "6,2": { letter: "D" }, "7,2": { open: true },
            }} />
            <Grid rows={9} cols={12} cell={26} label="3. Write PERFORMS above it" cells={{
              "0,0": { open: true },
              "0,1": { letter: "P", valid: true }, "0,2": { letter: "E", valid: true }, "0,3": { letter: "R", valid: true },
              "0,4": { letter: "F", valid: true }, "0,5": { letter: "O", valid: true }, "0,6": { letter: "R", valid: true },
              "0,7": { letter: "M", valid: true }, "0,8": { letter: "S", valid: true },
              "0,9": { open: true },
              "1,1": { open: true }, "1,2": { letter: "R", valid: true }, "1,3": { letter: "E", valid: true },
              "2,3": { letter: "S", valid: true }, "3,3": { letter: "P", valid: true },
              "4,3": { letter: "O", valid: true }, "5,3": { letter: "N", valid: true },
              "6,3": { letter: "D", valid: true }, "7,3": { open: true },
            }} />
          </Card>
          <Card>
            <SubHead>Kick Out</SubHead>
            <P style={{ fontSize: 14 }}>
              Carve <strong>the last letter</strong>, then write along the bottom, rewriting the word.
            </P>
            <Grid rows={8} cols={13} cell={24} label="1. Start with SURFBOARD" cells={{
              "2,5": { open: true },
              "2,6": { letter: "S" }, "2,7": { letter: "U" }, "2,8": { letter: "R" }, "2,9": { letter: "F" },
              "2,10": { letter: "B" },
              "3,10": { letter: "O" }, "4,10": { letter: "A" }, "5,10": { letter: "R" },
              "6,10": { letter: "D" },
              "7,10": { open: true },
            }} />
            <Grid rows={8} cols={13} cell={24} label="2. Kick out the final D" cells={{
              "2,5": { open: true },
              "2,6": { letter: "S" }, "2,7": { letter: "U" }, "2,8": { letter: "R" }, "2,9": { letter: "F" },
              "2,10": { letter: "B" },
              "3,10": { letter: "O" }, "4,10": { letter: "A" }, "5,10": { letter: "R" }, "5,11": { letter: "D" },
              "5,12": { open: true },
            }} />
            <Grid rows={8} cols={13} cell={24} label="3. Write DEMOLISHED into that D" cells={{
              "2,5": { open: true },
              "2,6": { letter: "S", valid: true }, "2,7": { letter: "U", valid: true },
              "2,8": { letter: "R", valid: true }, "2,9": { letter: "F", valid: true },
              "2,10": { letter: "B", valid: true },
              "3,10": { letter: "O", valid: true }, "4,10": { letter: "A", valid: true },
              "5,10": { letter: "R", valid: true }, "5,11": { letter: "D" },
              "5,12": { open: true },
              "6,0": { open: true },
              "6,1": { letter: "D", valid: true }, "6,2": { letter: "E", valid: true },
              "6,3": { letter: "M", valid: true }, "6,4": { letter: "O", valid: true },
              "6,5": { letter: "L", valid: true }, "6,6": { letter: "I", valid: true },
              "6,7": { letter: "S", valid: true }, "6,8": { letter: "H", valid: true },
              "6,9": { letter: "E", valid: true }, "6,10": { letter: "D", valid: true },
              "6,11": { open: true },
              "7,10": { open: true },
            }} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: 20 }}>
          <Card>
            <SubHead>Cut-Back</SubHead>
            <P>
              Writing across a word is a <strong>single cut-back</strong>. You can also &ldquo;cut and come back&rdquo; after
              reusing 2+ tiles from another word — sharing a run of letters between two words.
            </P>
            <Grid rows={12} cols={12} cell={26} label="1. Start with NATIONWIDE" cells={{
              "6,0": { open: true },
              "6,1": { letter: "N" }, "6,2": { letter: "A" }, "6,3": { letter: "T" },
              "6,4": { letter: "I" }, "6,5": { letter: "O" }, "6,6": { letter: "N" },
              "6,7": { letter: "W" }, "6,8": { letter: "I" }, "6,9": { letter: "D" },
              "6,10": { letter: "E" },
              "6,11": { open: true },
            }} />
            <Grid rows={12} cols={12} cell={26} label="2. Bend NATIONWIDE" cells={{
              "3,4": { open: true },
              "4,4": { letter: "N" }, "5,4": { letter: "A" }, "6,4": { letter: "T" },
              "6,5": { letter: "I" }, "6,6": { letter: "O" }, "6,7": { letter: "N" },
              "7,7": { letter: "W" }, "8,7": { letter: "I" }, "9,7": { letter: "D" },
              "10,7": { letter: "E" },
              "11,7": { open: true },
            }} />
            <Grid rows={12} cols={12} cell={26} label="3. Write CELEBRATIONS through TION" cells={{
              "3,4": { open: true },
              "4,4": { letter: "N" }, "5,4": { letter: "A" },
              "6,4": { letter: "T" }, "6,5": { letter: "I" },
              "6,6": { letter: "O" }, "6,7": { letter: "N" },
              "7,7": { letter: "W" }, "8,7": { letter: "I" }, "9,7": { letter: "D" },
              "10,7": { letter: "E" },
              "11,7": { open: true },
              "1,1": { open: true },
              "2,1": { letter: "C", valid: true }, "3,1": { letter: "E", valid: true },
              "4,1": { letter: "L", valid: true }, "5,1": { letter: "E", valid: true },
              "6,1": { letter: "B", valid: true }, "6,2": { letter: "R", valid: true },
              "6,3": { letter: "A", valid: true },
              "6,8": { letter: "S", valid: true },
              "6,9": { open: true },
            }} />
            <P style={{ marginBottom: 0, fontSize: 14 }}>
              The more letters in a cut-back, the harder it is to keep every word&apos;s pre/post spaces clear — which is what
              keeps the words distinguishable.
            </P>
          </Card>
          <Card>
            <SubHead>Moving shared tiles</SubHead>
            <P style={{ fontSize: 14 }}>
              A shared beginning or ending can be <strong>moved in a later round</strong> to open up space or new opportunities.
            </P>
            <Grid rows={8} cols={15} cell={24} label="1. Start with GENERATOR sharing OPERATOR" cells={{
              "0,3": { open: true }, "0,4": { letter: "G" }, "0,5": { letter: "E" }, "0,6": { letter: "N" },
              "1,6": { letter: "E" }, "2,6": { letter: "R" }, "3,6": { letter: "A" },
              "4,0": { open: true },
              "4,1": { letter: "O" }, "4,2": { letter: "P" }, "4,3": { letter: "E" },
              "4,4": { letter: "R" }, "4,5": { letter: "A" }, "4,6": { letter: "T" },
              "4,7": { letter: "O" }, "4,8": { letter: "R" },
              "4,9": { open: true },
            }} />
            <Grid rows={8} cols={15} cell={24} label="2. Flip the shared OR down" cells={{
              "0,3": { open: true }, "0,4": { letter: "G" }, "0,5": { letter: "E" }, "0,6": { letter: "N" },
              "1,6": { letter: "E" }, "2,6": { letter: "R" }, "3,6": { letter: "A" },
              "4,0": { open: true },
              "4,1": { letter: "O" }, "4,2": { letter: "P" }, "4,3": { letter: "E" },
              "4,4": { letter: "R" }, "4,5": { letter: "A" }, "4,6": { letter: "T" },
              "5,6": { letter: "O" }, "6,6": { letter: "R" },
              "7,6": { open: true },
            }} />
            <Grid rows={8} cols={15} cell={24} label="3. Add RAINBOWS from the moved R" cells={{
              "0,3": { open: true }, "0,4": { letter: "G" }, "0,5": { letter: "E" }, "0,6": { letter: "N" },
              "1,6": { letter: "E" }, "2,6": { letter: "R" }, "3,6": { letter: "A" },
              "4,0": { open: true },
              "4,1": { letter: "O" }, "4,2": { letter: "P" }, "4,3": { letter: "E" },
              "4,4": { letter: "R" }, "4,5": { letter: "A" }, "4,6": { letter: "T" },
              "5,6": { letter: "O" },
              "6,5": { open: true }, "6,6": { letter: "R" },
              "6,7": { letter: "A", valid: true }, "6,8": { letter: "I", valid: true },
              "6,9": { letter: "N", valid: true }, "6,10": { letter: "B", valid: true },
              "6,11": { letter: "O", valid: true }, "6,12": { letter: "W", valid: true },
              "6,13": { letter: "S", valid: true },
              "6,14": { open: true },
              "7,6": { open: true },
            }} />
            <P style={{ marginBottom: 0, fontSize: 14 }}>
              This reads <strong>RAINBOWS</strong>, not OPERATORAINBOWS. The final R is reused as the start of a new word.
            </P>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: 20 }}>
          <Card bg={PALETTE.rust} style={{ color: "#fff", gridColumn: "1 / -1", maxWidth: 620, justifySelf: "center" }}>
            <SubHead>Drop-ins are not allowed</SubHead>
            <P style={{ color: "#111", fontSize: 14 }}>
              You may share an interior letter to begin or end a separate word with its own empty pre- and post-spaces.
              You cannot combine part of the old word with the new word by turning at a straight, unbent shared letter.
            </P>
            <Grid rows={6} cols={9} cell={26} label="FELINES and EGGS share E; the combined FEGGS turn is forbidden" cells={{
              "0,2": { open: true }, "1,0": { open: true },
              "1,1": { letter: "F" }, "1,2": { letter: "E" }, "1,3": { letter: "L" },
              "1,4": { letter: "I" }, "1,5": { letter: "N" }, "1,6": { letter: "E" },
              "1,7": { letter: "S" }, "1,8": { open: true },
              "2,2": { letter: "G", valid: true }, "3,2": { letter: "G", valid: true },
              "4,2": { letter: "S", valid: true }, "5,2": { open: true },
            }} />
            <P style={{ color: "#111", marginBottom: 0, fontSize: 14 }}>
              New GGS below E establishes <strong>EGGS</strong>, with its pre-space above E. FELINES keeps its
              pre-space before F. Following F and then turning down at E to claim <strong>FEGGS</strong> is the forbidden Drop-In.
            </P>
          </Card>
        </div>
      </Band>

      <Band bg={PALETTE.cream}>
        <Head kicker="Surf-Fix" title="Scoring" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SubHead>Length points</SubHead>
            <P>
              The <strong>total number of tiles</strong> in the word — including pick tiles and reused tiles already on the
              board. Rewarded at <strong>7+ letters</strong>, same scale as Cross Fix.
            </P>
            <Note>
              To earn the length bonus, <strong>place at least one more new tile than the number you reuse.</strong> Reused
              letters can&apos;t outnumber new ones.
            </Note>
          </Card>
          <Card>
            <SubHead>Value points</SubHead>
            <P style={{ marginBottom: 0 }}>Point-values are tallied automatically from:</P>
            <Bullets
              items={[
                <>your <strong>Ride</strong>,</>,
                <>any word your Ride <strong>added onto / changed</strong>,</>,
                <><strong>rewritten</strong> words (Floaters &amp; Kick Outs),</>,
                <><strong>SBS of 3+ letters</strong> (2-letter SBS score nothing).</>,
              ]}
            />
          </Card>
        </div>
      </Band>

      <Band bg={PALETTE.sky}>
        <Head kicker="Single player" title="Climb the Ranks" />
        <P style={{ maxWidth: 680 }}>
          Play Surf-Fix solo — 16 words, total scoring, 4-minute rounds (6 for the last four). Your total earns a rank:
        </P>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
          {[
            { rank: "Kook", score: "under 700", bg: "#fff" },
            { rank: "Barney", score: "700 – 799", bg: PALETTE.cream },
            { rank: "Ripper", score: "800 – 899", bg: PALETTE.green },
            { rank: "Bomber", score: "900 – 999", bg: PALETTE.orange },
            { rank: "Master Kahuna / Wahine", score: "1000+", bg: PALETTE.rust },
          ].map((r, i) => (
            <div
              key={r.rank}
              className="k-card"
              style={{
                backgroundColor: r.bg,
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                transform: `rotate(${(i % 2 === 0 ? -0.5 : 0.5)}deg)`,
              }}
            >
              <span className="k-display" style={{ fontSize: 24, color: "#111" }}>{r.rank}</span>
              <span className="k-mono" style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{r.score}</span>
            </div>
          ))}
        </div>
      </Band>

      <section style={{ backgroundColor: "#111", padding: "72px 0", textAlign: "center" }}>
        <div className="k-page">
          <h2 className="k-display" style={{ margin: 0, fontSize: "clamp(40px, 7vw, 90px)", lineHeight: 0.95, color: "#fff", WebkitTextStroke: "2px #fff" }}>
            Ready to ride?
          </h2>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
            <Link href="/" className="k-btn" style={{ padding: "16px 26px", fontSize: 16, background: "#fff", color: "#111" }}>← Back home</Link>
            <Link href="/#modes" className="k-btn primary" style={{ padding: "16px 26px", fontSize: 16 }}>Check out the Games →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
