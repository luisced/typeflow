"use client";

import { useState } from "react";

const KEY = "typeflow.theme.v1";

export function useTheme() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  const toggle = (e?: { clientX: number; clientY: number }) => {
    const next = !dark;

    const apply = () => {
      document.documentElement.classList.toggle("dark", next);
      setDark(next);
      try {
        localStorage.setItem(KEY, next ? "dark" : "light");
      } catch {}
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Circular wipe from the click point — falls back to instant swap.
    const startVT = (
      document as Document & {
        startViewTransition?: (
          callback: () => void
        ) => { ready: Promise<void> };
      }
    ).startViewTransition?.bind(document);
    if (!startVT || reduced || !e) {
      apply();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = startVT(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.22, 0.8, 0.28, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return { dark, toggle };
}
