"use client";

interface Props {
  errorMap: Record<string, number>;
}

const ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

const ON_BOARD = new Set("qwertyuiopasdfghjklzxcvbnm".split(""));

function heat(count: number, max: number): React.CSSProperties {
  if (!count) return {};
  const t = count / max; // 0..1
  return {
    background: `rgba(192, 57, 43, ${(0.16 + t * 0.58).toFixed(2)})`,
    borderColor: `rgba(192, 57, 43, ${(0.28 + t * 0.45).toFixed(2)})`,
    color: t > 0.5 ? "#fff" : "var(--text)",
  };
}

export default function KeyHeatmap({ errorMap }: Props) {
  const max = Math.max(1, ...Object.values(errorMap));
  const space = errorMap[" "] || 0;
  const others = Object.entries(errorMap)
    .filter(([k]) => k !== " " && !ON_BOARD.has(k))
    .sort((a, b) => b[1] - a[1]);

  const Key = ({ ch, count }: { ch: string; count: number }) => (
    <div
      className="kbd-key"
      style={heat(count, max)}
      title={count ? `${ch === " " ? "space" : ch}: ${count} miss${count > 1 ? "es" : ""}` : ch === " " ? "space" : ch}
    >
      {ch !== " " && <span>{ch}</span>}
      {count > 0 && <span className="kbd-count">{count}</span>}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-1.5">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5" style={{ marginLeft: ri * 16 }}>
          {row.map((ch) => (
            <Key key={ch} ch={ch} count={errorMap[ch] || 0} />
          ))}
        </div>
      ))}

      <div className="kbd-key kbd-space" style={heat(space, max)}>
        {space > 0 && <span className="kbd-count">{space}</span>}
      </div>

      {others.length > 0 && (
        <div className="flex gap-1.5 mt-1.5 flex-wrap justify-center max-w-[420px]">
          {others.map(([ch, count]) => (
            <Key key={ch} ch={ch} count={count} />
          ))}
        </div>
      )}

      {/* legend */}
      <div className="flex items-center gap-2 mt-3 text-dim text-[10px] uppercase tracking-[0.16em]">
        <span>fewer</span>
        <div className="flex gap-1">
          {[0.18, 0.38, 0.58, 0.78].map((o) => (
            <span
              key={o}
              className="w-4 h-2.5 rounded-sm"
              style={{ background: `rgba(192,57,43,${o})` }}
            />
          ))}
        </div>
        <span>more misses</span>
      </div>
    </div>
  );
}
