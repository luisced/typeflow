"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import TypingArea from "@/components/TypingArea";
import LiveStats from "@/components/LiveStats";
import Results from "@/components/Results";
import AuthGate from "@/components/AuthGate";
import { attemptSilentRefresh, fetchRunById, getAccessToken } from "@/lib/api";
import { getUser, subscribe } from "@/lib/auth";
import { testResultFromRecord } from "@/lib/historyResult";
import { isOnline } from "@/lib/network";
import { loadHistory, mergeHistory } from "@/lib/storage";
import { syncNow } from "@/lib/sync";
import { useTypingTest, type TestResult } from "@/lib/useTypingTest";
import { loadContentFlags, saveContentFlags } from "@/lib/contentFlags";
import { correctChars } from "@/lib/engine";
import {
  charsAhead,
  ensureGhostForConfig,
  ghostAccuracy as ghostTraceAccuracy,
  ghostCorrectAt,
  ghostMatchesQuote,
  ghostMistakeActive,
  ghostMistakesAt,
  ghostPositionAt,
  loadGhostEnabled,
  saveGhostEnabled,
} from "@/lib/ghost";
import { targetKeysForPractice } from "@/lib/weakness";
import type { CaretStyle, TestConfig } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";

const CARET_KEY = "typeflow.caret.v1";

function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<TestConfig>(() => ({
    mode: "time",
    value: 30,
    flags: loadContentFlags(),
  }));
  const [historyResult, setHistoryResult] = useState<TestResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState(() => loadGhostEnabled());
  const [caretStyle, setCaretStyle] = useState<CaretStyle>(() => {
    try {
      const saved = window.localStorage.getItem(CARET_KEY) as CaretStyle | null;
      return saved ?? "line";
    } catch {
      return "line";
    }
  });
  const hasSession = () => !!getUser();
  const [authChecked, setAuthChecked] = useState(hasSession);
  const [loggedIn, setLoggedIn] = useState(hasSession);
  const [showAuth, setShowAuth] = useState(false);
  const { dark, toggle: toggleTheme } = useTheme();

  useEffect(
    () =>
      subscribe(() => {
        const active = hasSession();
        setLoggedIn(active);
        if (active) setShowAuth(false);
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    void attemptSilentRefresh().then(() => {
      if (cancelled) return;
      setLoggedIn(hasSession());
      setAuthChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeCaretStyle = useCallback((s: CaretStyle) => {
    setCaretStyle(s);
    try {
      window.localStorage.setItem(CARET_KEY, s);
    } catch {
      /* ignore */
    }
  }, []);

  const test = useTypingTest(config);
  const testRef = useRef(test);
  useEffect(() => {
    testRef.current = test;
  }, [test]);

  const changeConfig = useCallback(
    (c: TestConfig) => {
      setConfig(c);
      if (c.flags) saveContentFlags(c.flags);
      test.reset(c);
    },
    [test]
  );

  const retry = useCallback(() => testRef.current.reset(), []);
  const newTest = useCallback(() => testRef.current.reset(), []);

  const goHome = useCallback(() => {
    setHistoryResult(null);
    setHistoryError(null);
    setHistoryLoading(false);
    testRef.current.reset();
  }, []);

  const viewHistoryRun = useCallback(async (id: string) => {
    testRef.current.reset();
    setHistoryError(null);

    const showCached = () => {
      const cached = loadHistory().find((r) => r.id === id);
      if (cached) {
        setHistoryResult(testResultFromRecord(cached));
        return true;
      }
      return false;
    };

    if (isOnline() && getAccessToken()) {
      setHistoryLoading(true);
      try {
        const record = await fetchRunById(id);
        mergeHistory([record]);
        setHistoryResult(testResultFromRecord(record));
      } catch {
        if (!showCached()) {
          setHistoryError("Run not available offline");
        }
      } finally {
        setHistoryLoading(false);
      }
      return;
    }

    if (!showCached()) {
      setHistoryError("Run not available offline");
    }
  }, []);

  const openedRunRef = useRef<string | null>(null);

  useEffect(() => {
    const runId = searchParams.get("run");
    if (!runId || !authChecked || !loggedIn) return;
    if (openedRunRef.current === runId) return;
    openedRunRef.current = runId;
    void viewHistoryRun(runId).finally(() => {
      router.replace("/", { scroll: false });
      openedRunRef.current = null;
    });
  }, [searchParams, authChecked, loggedIn, viewHistoryRun, router]);

  const retryHistoryRun = useCallback(() => {
    if (!historyResult) return;
    const cfg: TestConfig = {
      mode: historyResult.record.mode,
      value: historyResult.record.value,
    };
    setConfig(cfg);
    setHistoryResult(null);
    testRef.current.reset(cfg);
  }, [historyResult]);

  useEffect(() => {
    if (!loggedIn) return;
    void attemptSilentRefresh().then(() => syncNow());
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [loggedIn]);

  const authGateVisible = !loggedIn && showAuth;

  useEffect(() => {
    if (authGateVisible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = testRef.current;

      if (e.key === "Escape") {
        if (historyResult) {
          setHistoryResult(null);
        }
        return;
      }
      if (historyResult) return;

      if (t.phase === "finished") {
        if (e.key === "Enter") {
          e.preventDefault();
          t.reset();
        } else if (e.key === "Tab") {
          e.preventDefault();
          t.reset();
        }
        return;
      }

      if (t.phase === "paused") {
        if (e.key.length === 1 || e.key === "Backspace" || e.key === " ") {
          if (e.key === " " || e.key === "Backspace") e.preventDefault();
          t.resumeWithKey(e.key);
          return;
        }
        t.resume();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        t.reset();
        return;
      }
      if (e.key === " " || e.key === "Backspace") e.preventDefault();
      if (e.key.length === 1 || e.key === "Backspace" || e.key === " ") {
        t.onKey(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyResult, authGateVisible]);

  useEffect(() => {
    if (authGateVisible) return;
    const onBlur = () => testRef.current.pause();
    const onVisibility = () => {
      if (document.hidden) testRef.current.pause();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authGateVisible]);

  const progress = `${test.engine.wordIndex}/${
    config.mode === "quote" ? test.engine.words.length : config.value
  }`;

  const ghostForConfig =
    config.mode !== "practice" ? ensureGhostForConfig(config) : null;
  const ghostTrace = ghostEnabled ? ghostForConfig : null;
  const ghostActive =
    ghostTrace &&
    ghostMatchesQuote(ghostTrace, test.engine.words) &&
    (config.mode !== "quote" || ghostTrace.quoteText === test.engine.words.join(" "));
  const ghostCaret =
    ghostActive && test.phase === "running"
      ? ghostPositionAt(test.engine, ghostTrace, test.elapsed)
      : null;
  const ghostAhead =
    ghostActive && test.phase === "running"
      ? charsAhead(
          correctChars(test.engine),
          ghostCorrectAt(ghostTrace, test.elapsed)
        )
      : null;
  const ghostAccuracy = ghostActive ? ghostTraceAccuracy(ghostTrace) : null;
  const ghostMistakes =
    ghostActive && test.phase === "running"
      ? ghostMistakesAt(ghostTrace, test.elapsed)
      : null;
  const ghostStumble =
    ghostActive && test.phase === "running"
      ? ghostMistakeActive(ghostTrace, test.elapsed)
      : false;

  const practiceTargets =
    config.mode === "practice" ? targetKeysForPractice(loadHistory()) : [];
  const practiceIdleHint =
    practiceTargets.length > 0
      ? `targeting: ${practiceTargets.map((k) => `\`${k === " " ? "space" : k}\``).join(" ")}`
      : "type a few normal tests first — no weak keys yet";

  const activeResult =
    historyResult ?? (test.phase === "finished" ? test.result : null);
  const showResults = !!activeResult;

  if (!authChecked) {
    return <div className="auth-boot" aria-busy="true" aria-label="Loading session" />;
  }

  if (!loggedIn && showAuth) {
    return <AuthGate onClose={() => setShowAuth(false)} />;
  }

  return (
    <main
      className={`app-shell relative z-10 min-h-dvh flex flex-col px-6 md:px-10 py-7 max-w-[1080px] mx-auto w-full${
        showResults ? " app-shell--results" : ""
      }`}
    >
      <div
        className="topbar-wrap shrink-0"
        data-hidden={test.phase === "running"}
        aria-hidden={test.phase === "running"}
      >
        <TopBar
          config={config}
          onChange={changeConfig}
          onOpenProfile={() => router.push("/profile")}
          onOpenLeaderboard={() => router.push("/leaderboard")}
          onSignIn={() => setShowAuth(true)}
          onGoHome={goHome}
          disabled={test.phase === "running"}
          caretStyle={caretStyle}
          onCaretStyle={changeCaretStyle}
          ghostEnabled={ghostEnabled}
          onGhostToggle={(on) => {
            setGhostEnabled(on);
            saveGhostEnabled(on);
          }}
          ghostWpm={ghostForConfig?.wpm ?? null}
          ghostAccuracy={ghostForConfig ? ghostTraceAccuracy(ghostForConfig) : null}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </div>

      <section
        className={
          showResults
            ? "results-section flex min-h-0 flex-1 flex-col gap-8"
            : "flex min-h-0 flex-1 flex-col justify-center gap-8 -mt-6"
        }
      >
          {historyLoading ? (
            <div className="flex flex-col items-center gap-3 text-dim text-sm" aria-busy="true">
              <span className="history-loading-spinner" aria-hidden />
              Loading run…
            </div>
          ) : historyError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-dim text-sm">{historyError}</p>
              <button className="ghost" onClick={goHome}>
                ← back
              </button>
            </div>
          ) : showResults && activeResult ? (
            <Results
              result={activeResult}
              onRetry={historyResult ? retryHistoryRun : retry}
              onNew={newTest}
              historical={!!historyResult}
              onBack={historyResult ? goHome : undefined}
              caretStyle={caretStyle}
              onSignIn={loggedIn ? undefined : () => setShowAuth(true)}
            />
          ) : (
            <div className="relative left-1/2 -translate-x-1/2 w-[80vw] max-w-[1500px] flex flex-col gap-7">
              <LiveStats
                mode={config.mode}
                remaining={test.remaining}
                wpm={test.liveWpm}
                accuracy={test.liveAccuracy}
                elapsed={test.elapsed}
                progress={progress}
                visible={test.phase === "running" || test.phase === "paused"}
                ghostAhead={ghostActive ? ghostAhead : null}
                ghostAccuracy={ghostActive ? ghostAccuracy : null}
                ghostMistakes={ghostActive ? ghostMistakes : null}
              />

              <div
                key={`${config.mode}-${config.value}`}
                className="relative swap-in"
                style={{ animationDelay: "0.08s" }}
              >
                <TypingArea
                  engine={test.engine}
                  running={test.phase === "running"}
                  caretStyle={caretStyle}
                  ghostCaret={ghostActive ? ghostCaret : null}
                  ghostStumble={ghostStumble}
                />
              </div>

              <div className="flex justify-center">
                <span className="text-dim text-xs tracking-wide">
                  {test.phase === "idle" ? (
                    config.mode === "practice" ? practiceIdleHint : "start typing to begin"
                  ) : (
                    <>
                      <kbd>tab</kbd> restart
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
      </section>

      <footer
        className="flex shrink-0 items-center justify-between text-dim text-[11px] tracking-wide rise"
        style={{ animationDelay: "0.16s" }}
      >
        <span>TypeFlow</span>
        <span>
          <kbd>tab</kbd> restart · <kbd>esc</kbd> back · history syncs to your account
        </span>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}
