export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function isSafePosition(
  position: number,
  safePositions: Set<number>,
  winPosition: number,
  lastSafePositionsCount: number
): boolean {
  return (
    safePositions.has(position) ||
    position >= winPosition - lastSafePositionsCount
  );
}

export function generateSafePositions(
  playerCount: number,
  boardSize: number
): Set<number> {
  const safePositions = new Set<number>();
  for (let i = 0; i < playerCount; i++) {
    safePositions.add(i * (boardSize / playerCount));
  }
  return safePositions;
}
