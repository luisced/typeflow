import { describe, expect, it } from "vitest";
import {
  CARET_MOTION_EASING,
  CARET_MOTION_MS,
  caretMotionDuration,
  caretMotionStyle,
  caretTransform,
} from "./caretMotion";

describe("caretMotion", () => {
  it("targets the caret with a compositor-friendly translate3d transform", () => {
    expect(caretTransform({ left: 12.5, top: 34 })).toBe(
      "translate3d(12.5px, 34px, 0)"
    );
  });

  it("uses a short Monkeytype-style motion duration by default", () => {
    expect(caretMotionDuration({ reducedMotion: false })).toBe(CARET_MOTION_MS);
    expect(CARET_MOTION_MS).toBeLessThanOrEqual(100);
    expect(CARET_MOTION_EASING).toBe("cubic-bezier(0.37, 0, 0.63, 1)");
  });

  it("disables caret travel when reduced motion is requested", () => {
    expect(caretMotionDuration({ reducedMotion: true })).toBe(0);
  });

  it("builds a declarative style target without imperative animation state", () => {
    expect(
      caretMotionStyle({
        left: 8,
        top: 16,
        width: 4,
        height: 44,
      })
    ).toEqual({
      transform: "translate3d(8px, 16px, 0)",
      width: 4,
      height: 44,
    });
  });
});
