import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { EdamamClient, EdamamError } from './edamam/edamam.js';
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
  return block.plain_text.trim() === 'Shopping List';
}

function formatIngredient(ingredient: string) {
  return ingredient
    .replaceAll('½', '1/2')
    .replaceAll('⅓', '1/3')
    .replaceAll('¼', '1/4')
    .replaceAll('¾', '3/4');
}

function formatText(textBlocks: ReadonlyArray<{ plain_text: string }>): string {
  return textBlocks.map((block) => block.plain_text).join('');
}

async function recipeStats(page_id: string, url: string) {
  const blocks = (await notion.blocks.children.list({
    block_id: page_id,
  })) as any;

  const headingIndex = blocks.results.findIndex((block: any) => {
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
        ingredients.push(formatText(block.bulleted_list_item.text));
        break;
      case 'to_do':
        ingredients.push(formatText(block.to_do.text));
        break;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        const thisHeadingLevel = headingTypes[block.type];
        const parentHeadingLevel = headingTypes[heading.type];
        if (thisHeadingLevel <= parentHeadingLevel) {
          continueLoop = false;
        }
        break;
      case 'paragraph':
        // just skip paragraphs, usually subheaders or empty lines
        break;
      default:
        console.log(url, 'found weird item in shopping list', block);
        continueLoop = false;
        break;
    }

    if (!continueLoop) break;
  }

  // Give those ingredients to edamam
  try {
    const nutrition = await edamam.nutrition.fullRecipe({
      ingr: ingredients.map(formatIngredient),
    });

    const fiber = nutrition.totalNutrients.FIBTG.quantity;

    await notion.pages.update({
      page_id,
      properties: {
        Fiber: {
          number: Number(fiber.toFixed(1)),
        },
      },
    });
  } catch (err) {
    if (err instanceof EdamamError) {
      console.error(url, ingredients.map(formatIngredient));
    }
    throw err;
  }
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
          {
            property: 'Fiber',
            number: {
              is_empty: true,
            },
          },
        ],
      },
      start_cursor,
    });

    start_cursor = recipes.next_cursor ?? undefined;
    console.log(
      recipes.results
        .map((result) => (result as { url: string }).url)
        .join('\n'),
    );

    // for each recipe (or in parallel)
    const results = await Promise.allSettled(
      recipes.results.map((result) =>
        recipeStats(result.id, (result as { url: string }).url),
      ),
    );

    const badResults = results
      .map((result, i) => {
        switch (result.status) {
          case 'rejected':
            const recipe = recipes.results[i];
            return {
              reason: result.reason,
              recipe: {
                id: recipe.id,
                url: (recipe as { url: string }).url,
              },
            };
          default:
            return undefined;
        }
      })
      .filter(Boolean);

    console.error(badResults);
    console.error(`Failed ${badResults.length} recipes`);
  } while (start_cursor != undefined);
}

allRecipeStats();
