export type Rating = 0 | 3 | 4 | 5;

export interface Sm2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
  status: "learning" | "reviewing" | "mastered";
}

export const RATINGS: { value: Rating; label: string }[] = [
  { value: 0, label: "Again" },
  { value: 3, label: "Hard" },
  { value: 4, label: "Good" },
  { value: 5, label: "Easy" },
];

export const DAY_MS = 86_400_000;

export function nextReviewDateFromInterval(interval: number, from = new Date()) {
  return new Date(from.getTime() + interval * DAY_MS);
}

export function sm2(grade: Rating, state: Sm2State): Sm2State {
  const { easeFactor, interval, repetitions } = state;

  let nextEase = easeFactor;
  let nextRepetitions: number;
  let nextInterval: number;
  let nextStatus: Sm2State["status"];

  if (grade < 3) {
    nextRepetitions = 0;
    nextInterval = 0;
    nextStatus = "learning";
  } else {
    nextRepetitions = repetitions + 1;
    if (nextRepetitions === 1) nextInterval = 1;
    else if (nextRepetitions === 2) nextInterval = 6;
    else nextInterval = Math.round(interval * easeFactor);

    nextStatus = nextInterval >= 21 ? "mastered" : "reviewing";
  }

  nextEase = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (nextEase < 1.3) nextEase = 1.3;

  return {
    easeFactor: nextEase,
    interval: nextInterval,
    repetitions: nextRepetitions,
    status: nextStatus,
  };
}
