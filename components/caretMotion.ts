import type { CSSProperties } from "react";
import type { CaretBox } from "./caretGeometry";

export const CARET_MOTION_MS = 85;
export const CARET_MOTION_EASING = "cubic-bezier(0.37, 0, 0.63, 1)";

export function caretTransform(box: Pick<CaretBox, "left" | "top">): string {
  return `translate3d(${box.left}px, ${box.top}px, 0)`;
}

export function caretMotionDuration({
  reducedMotion,
}: {
  reducedMotion: boolean;
}): number {
  return reducedMotion ? 0 : CARET_MOTION_MS;
}

export function caretMotionStyle(box: CaretBox): CSSProperties {
  return {
    transform: caretTransform(box),
    width: box.width,
    height: box.height,
  };
}
