import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { FreeBusyInterval } from "../api/google-calendar.ts";

/**
 * Merge two already sorted lists of intervals.
 * https://www.geeksforgeeks.org/javascript-program-to-merge-two-sorted-lists-in-place/
 */
function* mergeSortedLists(
  listOne: readonly FreeBusyInterval[],
  listTwo: readonly FreeBusyInterval[],
): IterableIterator<FreeBusyInterval> {
  if (listOne.length === 0) {
    yield* listTwo;
  } else if (listTwo.length === 0) {
    yield* listOne;
  } else if (Temporal.Instant.compare(listOne[0].start, listTwo[0].start) < 0) {
    yield listOne[0];
    yield* mergeSortedLists(listOne.slice(1), listTwo);
  } else {
    yield listTwo[0];
    yield* mergeSortedLists(listOne, listTwo.slice(1));
  }
}

function max(a: Temporal.Instant, b: Temporal.Instant) {
  return Temporal.Instant.compare(a, b) > 0 ? a : b;
}

/**
 * Merge multiple free-busy lists into one, combining overlapping events.
 * https://www.geeksforgeeks.org/merging-intervals/
 */
export function mergeOverlappingIntervals(
  intervals: ReadonlyArray<readonly FreeBusyInterval[]>,
) {
  // Sort the intervals based on the increasing order of starting time.
  const sortedByStart = intervals.reduce(
    (acc, list) => Array.from(mergeSortedLists(acc, list)),
    [],
  );

  // Push the first interval into a stack.
  const stack = [{ ...sortedByStart[0] }];
  for (const interval of sortedByStart.slice(1)) {
    const topOfStack = stack.at(-1)!;
    // Check for overlapping interval
    if (
      Temporal.Instant.compare(topOfStack.start, interval.start) <= 0 &&
      Temporal.Instant.compare(interval.start, topOfStack.end) <= 0
    ) {
      // Overlap, merge the intervals
      topOfStack.end = max(topOfStack.end, interval.end);
    } else {
      stack.push({ ...interval });
    }
  }

  return stack;
}
