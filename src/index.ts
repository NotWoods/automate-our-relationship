import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { config } from 'dotenv';
import { EdamamClient, EdamamError } from './edamam/edamam.js';
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
 * @param url URL of the page, used as an ID for logging.
 * @returns Parsed ingredient structure list.
 */
async function recipeIngredients(page_id: string, url: string) {
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
    return;
  }

  // Get the ingredients in a block
  const ingredients = extractListItems(blocks, headingIndex).map((block) =>
    formatIngredient(formatText(block.rich_text)),
  );

  // Give those ingredients to edamam
  try {
    const nutrition = await edamam.nutrition.fullRecipe({
      ingr: ingredients,
    });

    return nutrition.ingredients;
  } catch (err) {
    if (err instanceof EdamamError) {
      console.error(url, ingredients);
    }
    throw err;
  }
}

class RecipeError extends Error {
  constructor(cause: Error, readonly page: QueryDatabaseResult) {
    super(`Recipe ${page.id} failed: ${cause.message}`, { cause });
  }
}

async function allRecipeStats() {
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

  const ingredientJobs: ReturnType<typeof recipeIngredients>[] = [];

  for await (const page of databasesQuery(notion, databaseFilter)) {
    const recipePage = page as FullQueryDatabaseResult;
    ingredientJobs.push(
      recipeIngredients(recipePage.id, recipePage.url).catch((error: Error) => {
        throw new RecipeError(error, recipePage);
      }),
    );
  }

  const results = await Promise.allSettled(ingredientJobs);
  const badResults = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  console.error(`Failed ${badResults.length} recipes`);
  console.error(
    badResults.map(({ reason }) =>
      reason instanceof RecipeError
        ? { recipe: reason.page, error: reason.cause }
        : reason,
    ),
  );
}

allRecipeStats();
