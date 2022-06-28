import type {
  GetBlockResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';

type Item<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer I>
  ? I
  : never;

export type BlockObjectResponse = Extract<GetBlockResponse, { type: string }>;

export type HeadingBlockObjectResponse = Extract<
  GetBlockResponse,
  { type: 'heading_1' | 'heading_2' | 'heading_3' }
>;

export type RichTextObjectResponse = Extract<
  GetBlockResponse,
  { type: 'heading_1' }
>['heading_1'];

export type QueryDatabaseResult = Item<QueryDatabaseResponse['results']>;
export type FullQueryDatabaseResult = Extract<
  QueryDatabaseResult,
  { url: string }
>;
