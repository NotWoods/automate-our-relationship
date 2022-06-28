/**
 * Normalize ingredient values for Edamam.
 */
export function formatIngredient(ingredient: string) {
  return ingredient
    .replaceAll('½', '1/2')
    .replaceAll('⅓', '1/3')
    .replaceAll('¼', '1/4')
    .replaceAll('¾', '3/4');
}
