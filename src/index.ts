import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { config } from 'dotenv';
import { EdamamClient } from './edamam/edamam.js';
import { formatIngredient } from './edamam/format.js';
import {
  extractListItems,
  findHeadingIndex,
  formatText,
} from './notion/blocks.js';
import { databasesQuery } from './notion/iterate.js';
import {
  BlockObjectResponse,
  FullQueryDatabaseResult,
  QueryDatabaseResult,
} from './notion/types.js';

config();

// https://github.com/makenotion/notion-sdk-js
const notion = new Client({
  auth: process.env['NOTION_TOKEN'],
});

const edamam = new EdamamClient({
  app_id: process.env['EDAMAM_APP_ID']!,
  app_key: process.env['EDAMAM_APP_KEY']!,
});

/**
 * Extract the ingredients from a given Notion page.
 * @param page_id ID of the Notion page.
 * @returns Parsed ingredient structure list.
 */
async function recipeIngredients(page_id: string) {
  const response = await notion.blocks.children.list({
    block_id: page_id,
  });
  const blocks = response.results as BlockObjectResponse[];

  const headingIndex = findHeadingIndex(
    blocks as BlockObjectResponse[],
    /shopping list/i,
  );
  if (headingIndex === -1) {
    // No shopping list
    return [];
  }

  // Get the ingredients in a block
  const ingredients = extractListItems(blocks, headingIndex).map((block) =>
    formatIngredient(formatText(block.rich_text)),
  );

  return ingredients
}

class RecipeError extends Error {
  constructor(cause: Error, readonly page: QueryDatabaseResult) {
    super(`Recipe ${page.id} failed: ${cause.message}`, { cause });
  }
}

function isSettled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

async function getIngredientsFromRecipes(recipes) {
  const ingredientJobs = recipes.map(recipe => recipeIngredients(recipe.page_id))

  const results = await Promise.allSettled(ingredientJobs);
  const goodResults = results.filter(isSettled);
  const badResults = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  console.log(goodResults);

  console.error(`Failed ${badResults.length} recipes`);
  console.error(
    badResults.map(({ reason }) =>
      reason instanceof RecipeError
        ? { recipe: reason.page, error: reason.cause }
        : reason,
    ),
  );
}

/**
 * Gets all the recipes on from the Notion page.
 */
export async function allRecipes() : Promise<FullQueryDatabaseResult[]> {
  const databaseFilter: QueryDatabaseParameters = {
    database_id: process.env['NOTION_DB']!,
    filter: {
      and: [
        {
          property: 'Tags',
          multi_select: { contains: 'Rotation' },
        },
      ],
    },
  };

  const recipes: FullQueryDatabaseResult[] = []
  for await (const page of databasesQuery(notion, databaseFilter)) {
    const recipePage = page as FullQueryDatabaseResult;
    recipes.push(recipePage);
  }

  return recipes
}

allRecipes();
