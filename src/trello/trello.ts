import { ApiClient } from '../api-client';

const BASE_URL = 'https://api.trello.com/';

export class TrelloClient extends ApiClient {
  constructor(readonly key: string, readonly token: string) {
    super(BASE_URL, { key, token });
  }

  readonly boards = {
    /**
     * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-lists-get
     */
    lists: async (
      boardId: string,
    ): Promise<
      {
        id: string;
        name: string;
        closed: boolean;
        idBoard: string;
        pos: number;
        subscribed: boolean;
      }[]
    > => {
      const response = await this.request({
        path: `/1/boards/${boardId}/lists`,
        method: 'post',
      });

      return (await response.json()) as {
        id: string;
        name: string;
        closed: boolean;
        idBoard: string;
        pos: number;
        subscribed: boolean;
      }[];
    },
  };
}
