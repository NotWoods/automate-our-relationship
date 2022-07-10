import { ApiClient } from "./api-client.ts";

const BASE_URL = "https://api.edamam.com/";

interface NutritionDetailsRequest {
  ingr: readonly string[];
}

interface NutritionDetailsResponse {
  ingredients: {
    text: string;
    parsed: {
      quantity: number;
      measure: string;
      foodMatch: string;
      foodId: string;
      food: string;
    }[];
  }[];
}

export class EdamamClient extends ApiClient {
  constructor(app_id: string, app_key: string) {
    super(BASE_URL, { app_id, app_key });
  }

  /**
   * https://developer.edamam.com/edamam-docs-nutrition-api
   */
  async nutritionDetails(
    body: NutritionDetailsRequest,
  ): Promise<NutritionDetailsResponse> {
    const response = await this.fetch(`/api/nutrition-details?beta=true`, {
      method: "post",
      body: JSON.stringify(body),
    });

    return response.json();
  }
}
