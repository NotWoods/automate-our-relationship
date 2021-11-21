import fetch, { Headers, Response } from 'node-fetch';

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

export type DietLabel =
  | 'BALANCED'
  | 'HIGH_FIBER'
  | 'HIGH_PROTEIN'
  | 'LOW_CARB'
  | 'LOW_FAT'
  | 'LOW_SODIUM';

export type HealthLabel =
  | 'ALCOHOL_COCKTAIL'
  | 'ALCOHOL_FREE'
  | 'CELERY_FREE'
  | 'CRUSTCEAN_FREE'
  | 'DAIRY_FREE'
  | 'DASH'
  | 'EGG_FREE'
  | 'FISH_FREE'
  | 'FODMAP_FREE'
  | 'GLUTEN_FREE'
  | 'IMMUNO_SUPPORTIVE'
  | 'KETO_FRIENDLY'
  | 'KIDNEY_FRIENDLY'
  | 'KOSHER'
  | 'LOW POTASSIUM'
  | 'LOW SUGAR'
  | 'LUPINE_FREE'
  | 'MEDITERRANEAN'
  | 'MOLLUSK_FREE'
  | 'MUSTARD_FREE'
  | 'NO OIL ADDED'
  | 'PALEO'
  | 'PEANUT_FREE'
  | 'PESCATARIAN'
  | 'PORK_FREE'
  | 'RED_MEAT_FREE'
  | 'SESAME_FREE'
  | 'SHELLFISH_FREE'
  | 'SOY_FREE'
  | 'SUGAR_CONSCIOUS'
  | 'SULFITE_FREE'
  | 'TREE_NUT_FREE'
  | 'VEGAN'
  | 'VEGETARIAN'
  | 'WHEAT_FREE';

export type NTRCode =
  | 'CA'
  | 'SUGAR.added'
  | 'CA'
  | 'CHOCDF.net'
  | 'CHOCDF'
  | 'CHOLE'
  | 'ENERC_KCAL'
  | 'FAMS'
  | 'FAPU'
  | 'FASAT'
  | 'FATRN'
  | 'FIBTG'
  | 'FOLDFE'
  | 'FOLFD'
  | 'FOLAC'
  | 'FE'
  | 'MG'
  | 'NIA'
  | 'P'
  | 'K'
  | 'PROCNT'
  | 'RIBF'
  | 'NA'
  | 'Sugar.alcohol'
  | 'SUGAR'
  | 'THIA'
  | 'FAT'
  | 'VITA_RAE'
  | 'VITB12'
  | 'VITB6A'
  | 'VITC'
  | 'VITD'
  | 'TOCPHA'
  | 'VITK1'
  | 'WATER'
  | 'ZN';

interface NutrientStructure {
  /** Ontology identifier */
  uri?: string;
  /** Display label */
  label: string;
  /** Quantity of specified `unit`s */
  quantity: number;
  /** Units */
  unit: string;
}

interface IngredientStructure {
  /** Food identifier */
  foodId: string;
  /** Quantity of specified `measure` */
  quantity: number;
  measure: string;
  /** Total weight, g */
  weight: number;
  foodMatch: string;
  food: string;
  /** Shopping aisle category */
  foodCategory?: string;
  retainedWeight: number;
  nutrients: Record<NTRCode, NutrientStructure>;
  measureURI: string;
  status: string;
}

interface NutritionFullRecipeResponse {
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

export class EdamamClient {
  private app_id: string;
  private app_key: string;

  private recipeTags = new WeakMap<NutritionFullRecipeRequest, string>();

  constructor(options: EdamamOptions) {
    this.app_id = options.app_id;
    this.app_key = options.app_key;
  }

  async request({
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
      throw new Error(`Edamam error ${response.status}`);
    }
  }

  readonly nutrition = {
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
