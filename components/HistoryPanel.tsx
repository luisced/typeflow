"use client";

import { useState } from "react";
import { loadHistory } from "@/lib/storage";
import { clearAllHistory } from "@/lib/sync";

interface Props {
  open: boolean;
  onClose: () => void;
  refreshKey: number;
}

export default function HistoryPanel({
  open,
  onClose,
  refreshKey,
}: Props) {
  const [, bumpHistory] = useState(0);
  const history = open ? loadHistory() : [];

  const best = history.reduce((m, r) => Math.max(m, r.wpm), 0);
  const avg = history.length
    ? Math.round(history.reduce((s, r) => s + r.wpm, 0) / history.length)
    : 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(180,175,165,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 z-50 h-full w-[380px] max-w-[90vw] p-6 overflow-y-auto transition-transform duration-300"
        style={{
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-8px 0 40px -10px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl">History</h2>
          <button className="ghost" onClick={onClose}>
            close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="panel p-4">
            <div className="stat-num text-accent" style={{ fontSize: 32 }}>
              {best}
            </div>
            <div className="text-dim text-[10px] uppercase tracking-widest mt-1">
              best wpm
            </div>
          </div>
          <div className="panel p-4">
            <div className="stat-num" style={{ fontSize: 32 }}>
              {avg}
            </div>
            <div className="text-dim text-[10px] uppercase tracking-widest mt-1">
              avg wpm
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-dim text-sm leading-relaxed">
            No runs yet. Finish a test and it shows up here.
          </p>
        ) : (
          <div key={refreshKey} className="space-y-2">
            {history.map((r) => (
              <div
                key={r.id}
                className="panel flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="font-display text-xl text-accent leading-none">
                    {r.wpm}
                    <span className="text-dim text-xs font-sans ml-1">wpm</span>
                  </div>
                  <div className="text-dim text-[11px] mt-1">
                    {r.accuracy}% ·{" "}
                    {r.mode === "time"
                      ? `${r.value}s`
                      : r.mode === "words"
                      ? `${r.value}w`
                      : "quote"}
                  </div>
                </div>
                <div className="text-dim text-[11px] text-right">
                  {new Date(r.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  <br />
                  {new Date(r.date).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <button
            className="ghost w-full mt-6"
            onClick={async () => {
              try {
                await clearAllHistory();
              } catch {
                /* offline — local clear still applied inside clearAllHistory */
              }
              bumpHistory((v) => v + 1);
            }}
          >
            clear history
          </button>
        )}
      </aside>
    </>
  );
}
