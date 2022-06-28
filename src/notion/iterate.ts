import type { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';

interface CursorResponse<T> {
  next_cursor: string | null;
  results: T[];
}

/**
 * Async iterator wrapper for the Notion API.
 * Converts a cursor-based query into a promise-based iterator.
 */
export async function* notionIterator<T>(
  getPage: (start_cursor: string | undefined) => Promise<CursorResponse<T>>,
) {
  let start_cursor: string | undefined = undefined;
  do {
    const recipes: CursorResponse<T> = await getPage(start_cursor);

    start_cursor = recipes.next_cursor ?? undefined;

    yield* recipes.results;
  } while (start_cursor != undefined);
}

export function databasesQuery(notion: Client, args: QueryDatabaseParameters) {
  return notionIterator((start_cursor) =>
    notion.databases.query({
      ...args,
      start_cursor,
    }),
  );
}
