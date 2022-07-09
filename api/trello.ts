import { ApiClient } from "./api-client.ts";

const BASE_URL = "https://api.trello.com/";

interface ListResponse {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
  subscribed: boolean;
}

interface Card {
  id: string;
  address?: string;
  checkItemStates: string[];
  closed: boolean;
  coordinates?: boolean;
  dateLastActivity: string;
  desc: string;
  descData: unknown;
  due?: string;
  dueReminder?: string;
  email: string;
  idBoard: string;
  idList: string;
  name: string;
  url: string;
}

interface CardRequest extends Partial<Card> {
  idList: string;
  pos?: "top" | "bottom" | number;
}

export class TrelloClient extends ApiClient {
  constructor(key: string, token: string) {
    super(BASE_URL, { key, token });
  }

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-lists-get
   */
  async listsOnBoard(boardId: string): Promise<ListResponse[]> {
    const response = await this.fetch(`/1/boards/${boardId}/lists`);
    return await response.json();
  }

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-post
   */
  async createCard(card: CardRequest): Promise<Card> {
    const response = await this.fetch(`/1/cards`, {
      method: "post",
      query: new URLSearchParams(card as unknown as Record<string, string>),
    });
    return await response.json();
  }

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-cards-get
   */
  async cardsInList(listId: string): Promise<Card[]> {
    const response = await this.fetch(`/1/lists/${listId}/cards`);
    return await response.json();
  }

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-archiveallcards-post
   */
  async archiveAllCardsInList(listId: string): Promise<void> {
    await this.fetch(`/1/lists/${listId}/archiveAllCards`, {
      method: "post",
    });
  }
}
