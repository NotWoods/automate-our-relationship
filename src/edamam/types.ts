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

export interface NutrientStructure {
  /** Ontology identifier */
  uri?: string;
  /** Display label */
  label: string;
  /** Quantity of specified `unit`s */
  quantity: number;
  /** Units */
  unit: string;
}

export interface IngredientStructure {
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
