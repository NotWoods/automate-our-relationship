import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { EdamamClient } from './edamam.js';

config();

// https://github.com/makenotion/notion-sdk-js
const notion = new Client({
  auth: process.env['NOTION_TOKEN'],
});

const edamam = new EdamamClient({
  app_id: process.env['EDAMAM_APP_ID']!,
  app_key: process.env['EDAMAM_APP_KEY']!,
});

async function recipeStats(page_id: string) {
  // TODO write program here

  const blocks = await notion.blocks.retrieve({
    block_id: page_id,
  });

  // .. get the ingredients as an array
  // .. give those ingredients to edamam
  const nutrition = await edamam.nutrition.fullRecipe({ ingr: [] });

  // .. store the result in a notion property? or print? dunno
  console.log(`\n\n---\n${page_id}:\n`, nutrition);
}

async function allRecipeStats() {
  // get every recipe
  const recipes = await notion.databases.query({
    database_id: process.env['NOTION_DB']!,
  });

  // for each recipe (or in parallel)
  await Promise.all(recipes.results.map((result) => recipeStats(result.id)));

  // celebrate and kiss tiger
}

allRecipeStats();
