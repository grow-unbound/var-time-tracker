/**
 * Picks a planning shift id (1/2/3) from ordered shift rows by local clock.
 * Assumes shifts are ordered 1st → 3rd (ascending id) and dayparts are
 * 06:00–14:00 / 14:00–22:00 / 22:00–06:00 local — adjust if business rules differ.
 */
export function defaultShiftIdFromTime(
  now: Date,
  shiftIdsInOrder: number[],
): number {
  if (shiftIdsInOrder.length === 0) {
    return 1;
  }
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 6 && h < 14) {
    return shiftIdsInOrder[0]!;
  }
  if (h >= 14 && h < 22) {
    return shiftIdsInOrder[1] ?? shiftIdsInOrder[0]!;
  }
  return shiftIdsInOrder[2] ?? shiftIdsInOrder[shiftIdsInOrder.length - 1]!;
}
