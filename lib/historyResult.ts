import type { TestResult } from "./useTypingTest";
import { loadHistory, personalBest } from "./storage";
import type { RunRecord } from "./types";

export function testResultFromRecord(record: RunRecord): TestResult {
  const history = loadHistory();
  const prevBest = personalBest(history, record.mode, record.value, record.id);
  const isPB = record.wpm > prevBest && record.wpm > 0;
  return { record, isPB, prevBest };
}
