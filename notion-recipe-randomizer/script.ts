import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { TrelloClient } from "../api/trello.ts";
import {
  BlockObject,
  DatabasePage,
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
function getIngredientsFromRecipes(databaseId: string) {
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

  return arrayFrom(recipes);
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

async function addRecipeAsCard(recipe: DatabasePage, idList: string) {
  const name = await notionApi.retrievePageTitle(recipe.id);
  const card = await trelloApi.createCard({
    idList,
    name,
    urlSource: recipe.url,
  });

  if (recipe.cover) {
    await trelloApi.createAttachmentOnCard(card.id, {
      url: recipe.cover.external.url,
      setCover: true,
    });
  }
}

async function assignRecipesToLists(databaseId: string, boardId: string) {
  const [recipes, { weekdays }] = await Promise.all([
    getIngredientsFromRecipes(databaseId),
    getRecipeLists(boardId),
  ]);

  const recipesOfTheWeek = shuffleArray(recipes).slice(0, weekdays.length * 2);
  console.log("Selected recipes");

  // Create 2 cards, lunch and dinner, for each of the weekdays.
  await Promise.all(weekdays.map(async (weekday, index) => {
    await trelloApi.archiveAllCardsInList(weekday.id);

    const lunchIndex = index * 2;
    const dinnerIndex = (index * 2) + 1;

    await addRecipeAsCard(recipesOfTheWeek[lunchIndex], weekday.id);
    await addRecipeAsCard(recipesOfTheWeek[dinnerIndex], weekday.id);
    console.log(`Set ${weekday.name}`);
  }));
}

await assignRecipesToLists(
  configData["NOTION_DB"],
  configData["TRELLO_BOARD_ID"],
);
