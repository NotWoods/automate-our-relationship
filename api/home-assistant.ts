import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { ApiClient } from "./api-client.ts";
import type { InstantsToStrings } from "./google-calendar.ts";

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

interface GetHistoryRequest {
  start?: Temporal.Instant;
  end?: Temporal.Instant;
  minimal_response?: boolean;
  no_attributes?: boolean;
  significant_changes_only?: boolean;
}

interface MinimalHistoryResponse {
  last_changed: Temporal.Instant;
  state: string;
}

interface HistoryResponse extends MinimalHistoryResponse {
  entity_id: string;
  last_updated: Temporal.Instant;
}

type WithAttributes<Options extends GetHistoryRequest> = Options extends
  { no_attributes: true } ? unknown : { attributes: Record<string, string> };

export class HomeAssistantClient extends ApiClient {
  constructor(baseUrl: string, token: string) {
    super(baseUrl, undefined, {
      "Authorization": `Bearer ${token}`,
    });
  }

  /**
   * https://developers.home-assistant.io/docs/api/rest/
   * GET /api/history/period/<timestamp>
   */
  getHistory<Options extends GetHistoryRequest & { minimal_response: true }>(
    entityIds: readonly string[],
    options: Options,
  ): Promise<
    Array<
      [
        HistoryResponse & WithAttributes<Options>,
        ...Array<MinimalHistoryResponse & WithAttributes<Options>>,
      ]
    >
  >;
  getHistory<Options extends GetHistoryRequest>(
    entityIds: readonly string[],
    options: Options,
  ): Promise<Array<Array<HistoryResponse & WithAttributes<Options>>>>;
  async getHistory(
    entityIds: readonly string[],
    options: GetHistoryRequest,
  ): Promise<Array<MinimalHistoryResponse[]>> {
    const query = new URLSearchParams();
    query.set("filter_entity_ids", entityIds.join(","));
    if (options.end) {
      query.set("end_time", options.end.toString());
    }
    (["minimal_response", "no_attributes", "significant_changes_only"] as const)
      .filter((key) => options[key])
      .forEach((key) => query.set(key, "true"));

    const response = await this.fetch(
      `/api/history/period/${options.start?.toString() ?? ""}`,
      { query },
    );

    const dataArray: Array<
      InstantsToStrings<MinimalHistoryResponse & Partial<HistoryResponse>>[]
    > = await response.json();

    return dataArray.map((historyLogs) =>
      historyLogs.map(({ last_changed, last_updated, ...log }) => {
        const withInstants = log as
          & MinimalHistoryResponse
          & Partial<HistoryResponse>;
        withInstants.last_changed = Temporal.Instant.from(last_changed);
        if (last_updated) {
          withInstants.last_updated = Temporal.Instant.from(last_updated);
        }

        return withInstants;
      })
    );
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
