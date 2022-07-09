import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { TrelloClient } from "../api/trello.ts";
import {
  BlockObject,
  NotionClient,
  RichTextItemResponse,
} from "../api/notion.ts";
import { arrayFrom, isFulfilled, isRejected, shuffleArray } from "./utils.ts";

const configData = await config({ safe: true, defaults: undefined });
const notionApi = new NotionClient(configData["NOTION_TOKEN"]);
const trelloApi = new TrelloClient(
  configData["TRELLO_APP_KEY"],
  configData["TRELLO_TOKEN"],
);

/**
 * Consume the iterable of Notion blocks until reaching a heading with the given text.
 * @param blocks Blocks from a Notion page.
 * @param searchTerm Search term as regular expression.
 */
async function moveToHeading(
  blocks: AsyncIterable<BlockObject>,
  searchTerm: RegExp,
) {
  for await (const block of blocks) {
    let richText: { rich_text: RichTextItemResponse[] };
    switch (block.type) {
      case "heading_1":
        richText = block.heading_1;
        break;
      case "heading_2":
        richText = block.heading_2;
        break;
      case "heading_3":
        richText = block.heading_3;
        break;
      default:
        continue;
    }

    if (richText.rich_text.some((block) => searchTerm.test(block.plain_text))) {
      return block;
    }
  }
}

const headingLevels = {
  heading_1: 1,
  heading_2: 2,
  heading_3: 3,
} as const;

/**
 * Extract the shopping list item blocks from all the blocks in a page.
 */
async function extractShoppingListItems(blocks: AsyncIterable<BlockObject>) {
  const listHeading = await moveToHeading(blocks, /shopping list/i);
  if (!listHeading) {
    // No shopping list
    return [];
  }

  // Get the ingredients in a block
  const ingredients: { rich_text: RichTextItemResponse[] }[] = [];
  for await (const block of blocks) {
    let continueLoop = true;
    switch (block.type) {
      // Add list items to result list
      case "bulleted_list_item":
        ingredients.push(block.bulleted_list_item);
        break;
      case "to_do":
        ingredients.push(block.to_do);
        break;
      // Break when entering a new heading at the same or above level
      case "heading_1":
      case "heading_2":
      case "heading_3":
        if (headingLevels[block.type] <= headingLevels[listHeading.type]) {
          continueLoop = false;
        }
        break;
      // just skip paragraphs, usually subheaders or empty lines
      case "paragraph":
        break;
      default:
        console.warn("found weird item in shopping list", block);
        continueLoop = false;
        break;
    }

    if (!continueLoop) break;
  }

  return ingredients.map(function formatIngredientText({ rich_text }) {
    // Normalize ingredient values
    const ingredient = rich_text.map((block) => block.plain_text).join("");
    return ingredient
      .replaceAll("½", "1/2")
      .replaceAll("⅓", "1/3")
      .replaceAll("¼", "1/4")
      .replaceAll("¾", "3/4");
  });
}

/**
 * Extract the ingredients from the given Notion pages.
 */
async function getIngredientsFromRecipes(databaseId: string) {
  const recipes = notionApi.queryDatabases(databaseId, {
    filter: {
      and: [
        {
          property: "Tags",
          multi_select: { contains: "Rotation" },
        },
      ],
    },
  });

  const ingredientJobs = await arrayFrom(
    recipes,
    async (recipe) => ({
      // Recipe page
      recipe,
      // Shopping list from recipe page contents
      ingredients: await extractShoppingListItems(
        notionApi.blockChildren(recipe.id),
      ),
    }),
  );

  const results = await Promise.allSettled(ingredientJobs);
  const goodResults = results.filter(isFulfilled).map((result) => result.value);
  const badResults = results.filter(isRejected).map((result) => result.reason);

  return { goodResults, badResults };
}

/**
 * Returns Trello boards to add recipes to.
 */
async function getRecipeLists(boardId: string) {
  const [groceryList, ...weekdays] = await trelloApi.listsOnBoard(boardId);
  if (weekdays.length !== 7 && weekdays.length !== 5) {
    throw new Error(
      `Invalid board, expected 5 or 7 lists, got ${weekdays.length}`,
    );
  }

  return { groceryList, weekdays };
}

const { goodResults, badResults } = await getIngredientsFromRecipes(
  configData["NOTION_DB"],
);

if (badResults.length > 0) {
  console.error(`Failed ${badResults.length} recipes`);
  console.error(
    badResults.map(({ reason }) => reason),
  );
}

// Extract the recipe name.
function getRecipeName(recipe: any) {
  return Object.entries(recipe.properties).find((
    [propName],
  ) => propName === "Name");
}

const recipesOfTheWeek = shuffleArray(goodResults).slice(0, 12);
const { groceryList, weekdays } = await getRecipeLists(
  configData["TRELLO_BOARD_ID"],
);

/**
 * Create 2 cards, lunch and dinner, for each of the weekday.
 */
await Promise.all(weekdays.map(async (weekday, index) => {
  const lunchIndex = index * 2;
  const dinnerIndex = (index * 2) + 1;

  await Promise.all([
    trelloApi.createCard({
      idList: weekday.id,
      id: lunchIndex.toString(),
      name: getRecipeName(recipesOfTheWeek[lunchIndex].recipe),
      url: recipesOfTheWeek[lunchIndex].recipe.url,
    }),
    trelloApi.createCard({
      idList: weekday.id,
      id: dinnerIndex.toString(),
      name: getRecipeName(recipesOfTheWeek[dinnerIndex].recipe),
      url: recipesOfTheWeek[dinnerIndex].recipe.url,
    }),
  ]);
}));
