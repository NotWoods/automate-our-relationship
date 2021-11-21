import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { EdamamClient, NutritionFullRecipeResponse } from './edamam.js';
import { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import { headingTypes } from './blocks.js';

config();

// https://github.com/makenotion/notion-sdk-js
const notion = new Client({
  auth: process.env['NOTION_TOKEN'],
});

const edamam = new EdamamClient({
  app_id: process.env['EDAMAM_APP_ID']!,
  app_key: process.env['EDAMAM_APP_KEY']!,
});

function isShoppingList(block: { plain_text: string }) {
  return block.plain_text === 'Shopping List';
}

function formatIngredient(ingredient: string) {
  return ingredient.replaceAll('½', '1/2').replaceAll('⅓', '1/3');
}

async function recipeStats(page_id: string) {
  const blocks = await notion.blocks.children.list({
    block_id: page_id,
  });

  const headingIndex = blocks.results.findIndex((block) => {
    switch (block.type) {
      case 'heading_1':
        return block.heading_1.text.some(isShoppingList);
      case 'heading_2':
        return block.heading_2.text.some(isShoppingList);
      case 'heading_3':
        return block.heading_3.text.some(isShoppingList);
      default:
        return false;
    }
  });
  if (headingIndex === -1) {
    // No shopping list
    return;
  }

  const heading = blocks.results[headingIndex];

  // Get the ingredients in a block
  const ingredients: string[] = [];
  for (let i = headingIndex + 1; i < blocks.results.length; i++) {
    const block = blocks.results[i];
    let continueLoop = true;
    switch (block.type) {
      case 'bulleted_list_item':
        ingredients.push(block.bulleted_list_item.text[0].plain_text);
        break;
      case 'to_do':
        ingredients.push(block.to_do.text[0].plain_text);
        break;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        const thisHeadingLevel = headingTypes[block.type];
        const parentHeadingLevel = headingTypes[heading.type];
        if (thisHeadingLevel >= parentHeadingLevel) {
          continueLoop = false;
        }
        break;
      default:
        console.log('found weird item in shopping list', block);
        continueLoop = false;
        break;
    }

    if (!continueLoop) break;
  }

  console.log('---', ingredients.join(', \n'), '---');

  // Give those ingredients to edamam
  const nutrition = await edamam.nutrition.fullRecipe({
    ingr: ingredients.map(formatIngredient),
  });

  // Print the results
  console.log(`\n\n---\n${page_id}:\n`, nutrition.totalNutrients.FIBTG);

  const fiber = nutrition.totalNutrients.FIBTG.quantity;

  await notion.pages.update({
    page_id,
    properties: {
      Fiber: {
        number: Number(fiber.toFixed(1)),
      },
    },
  });
}

async function allRecipeStats() {
  let start_cursor: string | undefined = undefined;
  do {
    // get every recipe
    const recipes: QueryDatabaseResponse = await notion.databases.query({
      database_id: process.env['NOTION_DB']!,
      filter: {
        and: [
          {
            property: 'Tags',
            multi_select: {
              contains: 'Rotation',
            },
          },
        ],
      },
      start_cursor,
    });

    start_cursor = recipes.next_cursor ?? undefined;

    // for each recipe (or in parallel)
    const results = await Promise.allSettled(
      recipes.results
        // .filter((result) => result.id === process.env['TEST_PAGE'])
        .map((result) => recipeStats(result.id)),
    );

    console.error(
      results
        .map((result, i) => {
          switch (result.status) {
            case 'rejected':
              return {
                reason: result.reason,
                recipe: recipes.results[i],
              };
            default:
              return undefined;
          }
        })
        .filter(Boolean),
    );
  } while (start_cursor != undefined);

  // celebrate and kiss tiger
}

allRecipeStats();
