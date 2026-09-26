import type { Difficulty } from "../../../shared/api";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`badge badge-${difficulty.toLowerCase()}`}>{difficulty}</span>;
}
