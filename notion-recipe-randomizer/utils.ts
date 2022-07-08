/**
 * Check if a result from `Promise.allSettled` succeeded.
 */
export function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

/**
 * Check if a result from `Promise.allSettled` failed.
 */
export function isRejected(
  result: PromiseSettledResult<unknown>,
): result is PromiseRejectedResult {
  return result.status === "rejected";
}

/**
 * `Array.from` equivalent for async iterators.
 */
export async function arrayFrom<T>(iterable: AsyncIterable<T>): Promise<T[]>;
export async function arrayFrom<T, R>(
  iterable: AsyncIterable<T>,
  mapper: (item: T) => R,
): Promise<R[]>;
export async function arrayFrom<T, R>(
  iterable: AsyncIterable<T>,
  mapper: (item: T) => R = (item) => item as unknown as R,
): Promise<R[]> {
  const result: R[] = [];
  for await (const item of iterable) {
    result.push(mapper(item));
  }
  return result;
}

/**
 * Shuffling a copy of the array using the Fisher-Yates shuffle
 * https://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
 */
export function shuffleArray<T>(array: readonly T[]) {
  const shuffled = array.slice(0);
  let i = array.length;
  let temp;
  let index;
  while (i--) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled;
}
