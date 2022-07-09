import { ApiClient } from "./api-client.ts";

const BASE_URL = "https://api.notion.com/";

interface CursorResponse<T> {
  next_cursor: string | null;
  has_more: boolean;
  results: T[];
}

interface Cover {
  type: "external";
  external: { url: string };
}

export interface DatabasePage {
  id: string;
  cover: Cover;
  properties: Record<string, { id: string }>;
  url: string;
}

export interface RichTextItemResponse {
  plain_text: string;
  href?: string;
  annotations: unknown;
  type: "text" | "mention" | "equation";
}

interface BaseBlockObject {
  object: "block";
  id: string;
}

type TextBlock<
  Type extends string,
> =
  & BaseBlockObject
  & { type: Type }
  & Record<Type, {
    rich_text: RichTextItemResponse[];
    color: string;
  }>;

interface TodoBlock extends BaseBlockObject {
  type: "to_do";
  to_do: {
    rich_text: RichTextItemResponse[];
    color: string;
    checked: boolean;
  };
}

export type BlockObject =
  | TextBlock<"heading_1">
  | TextBlock<"heading_2">
  | TextBlock<"heading_3">
  | TextBlock<"paragraph">
  | TextBlock<"bulleted_list_item">
  | TextBlock<"numbered_list_item">
  | TextBlock<"quote">
  | TodoBlock;

interface TitlePropertyItem {
  object: "property_item";
  type: "title";
  id: "title";
  title: RichTextItemResponse;
}

function withCursor(startCursor: string | undefined) {
  const query = new URLSearchParams();
  if (startCursor !== undefined) {
    query.set("start_cursor", startCursor);
  }
  return query;
}

export class NotionClient extends ApiClient {
  constructor(token: string) {
    super(BASE_URL, undefined, {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    });
  }

  /**
   * Async iterator wrapper for the Notion API.
   * Converts a cursor-based query into a promise-based iterator.
   */
  private async *cursorFetch<T>(
    getPage: (start_cursor: string | undefined) => Promise<Response>,
  ) {
    let start_cursor: string | undefined = undefined;
    do {
      const response = await getPage(start_cursor);
      const page: CursorResponse<T> = await response.json();

      start_cursor = page.next_cursor ?? undefined;

      yield* page.results;
    } while (start_cursor != undefined);
  }

  /**
   * https://developers.notion.com/reference/post-database-query
   */
  queryDatabases(
    databaseId: string,
    body: {
      filter?: Partial<Record<"and" | "or", unknown[]>>;
      sorts?: unknown[];
    },
  ): AsyncIterableIterator<DatabasePage> {
    return this.cursorFetch((start_cursor) => {
      return this.fetch(`/v1/databases/${databaseId}/query`, {
        method: "post",
        query: withCursor(start_cursor),
        body: JSON.stringify({
          ...body,
          start_cursor,
          page_size: 100,
        }),
      });
    });
  }

  /**
   * https://developers.notion.com/reference/get-block-children
   */
  blockChildren(blockId: string): AsyncIterableIterator<BlockObject> {
    return this.cursorFetch((startCursor) =>
      this.fetch(`/v1/blocks/${blockId}/children`, {
        query: withCursor(startCursor),
      })
    );
  }

  /**
   * https://developers.notion.com/reference/retrieve-a-page-property
   */
  async retrievePageTitle(
    pageId: string,
  ): Promise<string> {
    const response = await this.fetch(`/v1/pages/${pageId}/properties/title`);
    const list: { results: TitlePropertyItem[] } = await response.json();
    return list.results[0].title.plain_text;
  }
}
