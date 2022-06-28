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

interface RequestParameters {
  path: string;
  method: 'get' | 'post';
  query?: URLSearchParams;
  body?: unknown;
  recipeTag?: string;
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

const BASE_URL = new URL('https://api.edamam.com/');

export class EdamamError extends Error {
  name = 'EdamamError';
}

export class EdamamClient {
  private app_id: string;
  private app_key: string;

  private recipeTags = new WeakMap<NutritionFullRecipeRequest, string>();

  constructor(options: EdamamOptions) {
    this.app_id = options.app_id;
    this.app_key = options.app_key;
  }

  private async request({
    path,
    method,
    query = new URLSearchParams(),
    body,
    recipeTag,
  }: RequestParameters): Promise<Response> {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of query) {
      url.searchParams.append(key, value);
    }
    url.searchParams.set('app_id', this.app_id);
    url.searchParams.set('app_key', this.app_key);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (recipeTag) {
      headers.set('If-None-Match', recipeTag);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: method !== 'get' ? JSON.stringify(body) : undefined,
    });

    if (response.ok) {
      return response;
    } else {
      throw new EdamamError(`${response.status}: ${await response.text()}`);
    }
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
