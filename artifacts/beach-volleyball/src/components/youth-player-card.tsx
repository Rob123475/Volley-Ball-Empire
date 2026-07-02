export interface YouthPlayerData {
  id: string;
  fullName: string;
  nationality: string;
  age: number;
  height: number;
  primaryRole: string;
  attackRating: number;
  defenceRating: number;
  serveRating: number;
  speedRating: number;
  staminaRating: number;
  potential: number;
}

function StatBar({ value }: { value: number }) {
  const filled = Math.min(10, Math.max(0, Math.round(value / 10)));
  return (
    <div style={{ display: "flex", gap: "2px", width: "100%", height: "100%" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "100%",
            background: i < filled ? "#C8A84B" : "#1a1a1a",
            borderRadius: "1px",
          }}
        />
      ))}
    </div>
  );
}

function PotentialStars({ value }: { value: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            color: i < value ? "#C8A84B" : "#2e2e2e",
            lineHeight: 1,
            display: "inline-block",
          }}
        >
          ★
        </span>
      ))}
    </>
  );
}

const STATS: Array<{
  key: keyof YouthPlayerData;
  top: string;
}> = [
  { key: "attackRating",   top: "60.3%" },
  { key: "defenceRating",  top: "65.3%" },
  { key: "serveRating",    top: "70.3%" },
  { key: "speedRating",    top: "75.35%" },
  { key: "staminaRating",  top: "80.35%" },
];

interface Props {
  player: YouthPlayerData;
  width?: number;
}

export function YouthPlayerCard({ player, width = 340 }: Props) {
  const aspectRatio = 1086 / 1448;
  const height = width / aspectRatio;

  const fs = (pct: number) => `${(width * pct) / 100}px`;

  return (
    <div
      style={{
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <img
        src="/images/youth/player_youth_card_01.webp"
        alt="Youth player card"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          borderRadius: "4%",
        }}
        draggable={false}
      />

      {/* ── Player name ───────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "29%",
          right: "3%",
          bottom: "68%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 4%",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontWeight: 900,
            fontSize: fs(7.2),
            lineHeight: 1.15,
            letterSpacing: "0.02em",
            textShadow: "0 1px 6px rgba(0,0,0,0.8)",
            wordBreak: "break-word",
          }}
        >
          {player.fullName}
        </span>
      </div>

      {/* ── Info rows (NATIONALITY / AGE / HEIGHT / ROLE) ───── */}
      {(
        [
          { label: "nationality", top: "36.6%", value: player.nationality },
          { label: "age",         top: "42.6%", value: String(player.age) },
          { label: "height",      top: "48.65%", value: `${player.height} cm` },
          { label: "role",        top: "54.7%", value: player.primaryRole },
        ] as const
      ).map(({ label, top, value }) => (
        <div
          key={label}
          style={{
            position: "absolute",
            top,
            left: "45%",
            right: "4%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontWeight: 700,
              fontSize: fs(4.5),
              letterSpacing: "0.03em",
              lineHeight: 1,
            }}
          >
            {value}
          </span>
        </div>
      ))}

      {/* ── Stat bars (ATTACK / DEFENCE / SERVE / SPEED / STAMINA) ── */}
      {STATS.map(({ key, top }) => {
        const value = player[key] as number;
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              top,
              left: "44.5%",
              right: "9.5%",
              height: "3.8%",
              display: "flex",
              alignItems: "center",
              gap: "4%",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "60%",
                background: "#111",
                borderRadius: "2px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <StatBar value={value} />
            </div>
            <span
              style={{
                color: "#C8A84B",
                fontWeight: 800,
                fontSize: fs(4.2),
                lineHeight: 1,
                minWidth: fs(6),
                textAlign: "right",
              }}
            >
              {value}
            </span>
          </div>
        );
      })}

      {/* ── Potential stars ────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "85.6%",
          left: "49%",
          right: "4%",
          bottom: "4.5%",
          display: "flex",
          alignItems: "center",
          gap: fs(1.5),
          fontSize: fs(8.5),
        }}
      >
        <PotentialStars value={player.potential} />
      </div>
    </div>
  );
}
