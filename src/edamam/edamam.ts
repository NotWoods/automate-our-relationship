import { ApiClient, RequestParameters } from '../api-client';
import type {
  DietLabel,
  HealthLabel,
  IngredientStructure,
  NTRCode,
  NutrientStructure,
} from './types';

interface EdamamOptions {
  app_id: string;
  app_key: string;
}

interface NutritionFullRecipeRequest {
  title?: string;
  ingr: readonly string[];
  url?: string;
  summary?: string;
  yield?: string;
  time?: string;
  img?: string;
  prep?: string;
  cuisine?: string;
  mealtype?: string;
  dishtype?: string;
}

interface NutritionFullRecipeOptions {
  force?: boolean;
}

export interface NutritionFullRecipeResponse {
  uri: string;
  yield: number;
  calories: number;
  totalWeight: number;
  dietLabels: DietLabel[];
  healthLabels: HealthLabel[];
  cautions: unknown[];
  totalNutrients: Record<NTRCode, NutrientStructure>;
  totalDaily: Record<NTRCode, NutrientStructure>;
  ingredients: { text: string; parsed: IngredientStructure[] }[];
}

const BASE_URL = 'https://api.edamam.com/';

export class EdamamClient extends ApiClient {
  private recipeTags = new WeakMap<NutritionFullRecipeRequest, string>();

  constructor(options: EdamamOptions) {
    super(BASE_URL, { app_id: options.app_id, app_key: options.app_key });
  }

  protected async request({
    recipeTag,
    ...options
  }: RequestParameters & { recipeTag?: string }): Promise<Response> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (recipeTag) {
      headers.set('If-None-Match', recipeTag);
    }

    return super.request({
      ...options,
      headers,
    });
  }

  readonly nutrition = {
    /**
     * https://developer.edamam.com/edamam-docs-nutrition-api#/
     */
    fullRecipe: async (
      body: NutritionFullRecipeRequest,
      options: NutritionFullRecipeOptions = {},
    ): Promise<NutritionFullRecipeResponse> => {
      const query = new URLSearchParams();
      if (options.force) {
        query.set('force', options.force.toString());
      }

      const response = await this.request({
        path: '/api/nutrition-details',
        method: 'post',
        query,
        body,
        recipeTag: this.recipeTags.get(body),
      });

      const eTag = response.headers.get('ETag');
      if (eTag) {
        this.recipeTags.set(body, eTag);
      }

      return (await response.json()) as NutritionFullRecipeResponse;
    },
  };
}
