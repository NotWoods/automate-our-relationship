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
  cover: { type: "external"; external: { url: string } } | null;
}

interface Checklist {
  id: string;
  name: string;
  idBoard: string;
  idCard: string;
  checkItems: unknown[];
}

interface CardRequest extends Partial<Card> {
  idList: string;
  pos?: "top" | "bottom" | number;
  urlSource?: string;
}

interface CardAttachmentRequest {
  name?: string;
  url: string;
  setCover?: boolean;
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
   * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-post
   */
  async createAttachmentOnCard(
    cardId: string,
    body: CardAttachmentRequest,
  ): Promise<Card> {
    const response = await this.fetch(`/1/cards/${cardId}/attachments`, {
      method: "post",
      body: JSON.stringify(body),
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

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checklists-post
   */
  async createChecklistOnCard(cardId: string): Promise<Checklist> {
    const response = await this.fetch(`/1/cards/${cardId}/checklists`, {
      method: "post",
      query: new URLSearchParams({ name: "Grocery List" }),
    });
    return await response.json();
  }

  /**
   * https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-checkitems-post
   */
  async createCheckItems(
    checklistId: string,
    ingredient: string,
  ): Promise<void> {
    await this.fetch(`/1/checklists/${checklistId}/checkItems`, {
      method: "post",
      query: new URLSearchParams({ name: ingredient }),
    });
  }
}
