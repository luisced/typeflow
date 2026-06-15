// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestConfig } from "./types";

describe("useTypingTest initial state", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("react");
    vi.restoreAllMocks();
  });

  it("seeds words before mount effects run", async () => {
    vi.resetModules();
    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");
      return {
        ...actual,
        useEffect: () => undefined,
      };
    });

    const [{ render }, { useTypingTest }] = await Promise.all([
      import("@testing-library/react"),
      import("./useTypingTest"),
    ]);

    const latest: { current: ReturnType<typeof useTypingTest> | null } = {
      current: null,
    };

    function getLatest() {
      if (!latest.current) {
        throw new Error("expected hook state to be captured");
      }
      return latest.current;
    }

    function Harness({ config }: { config: TestConfig }) {
      latest.current = useTypingTest(config);
      return null;
    }

    render(React.createElement(Harness, { config: { mode: "time", value: 30 } }));

    expect(getLatest().engine.words.length).toBeGreaterThan(0);
  });
});
