import { ApiClient } from "./api-client.ts";

interface StateRequest {
  state: string;
  attributes?: Record<string, string>;
}

interface StateResponse extends Required<StateRequest> {
  entity_id: string;
  last_changed: string;
  last_updated: string;
  /** False if the entity existed, true if a new entity was created */
  new: boolean;
  /** URL of the new resource */
  url: string | null;
}

export class HomeAssistantClient extends ApiClient {
  constructor(baseUrl: string, token: string) {
    super(baseUrl, undefined, {
      "Authorization": `Bearer ${token}`,
    });
  }

  /**
   * https://developers.home-assistant.io/docs/api/rest/
   * POST /api/states/<entity_id>
   */
  async setState(
    entityId: string,
    state: StateRequest,
  ): Promise<StateResponse> {
    const response = await this.fetch(`/api/states/${entityId}`, {
      method: "post",
      body: JSON.stringify(state),
    });

    const newState: Omit<StateResponse, "new"> = await response.json();
    return {
      ...newState,
      new: response.status === 201,
      url: response.headers.get("Location"),
    };
  }
}
