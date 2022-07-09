import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { TrelloClient } from "../api/trello.ts";
import {
  BlockObject,
  DatabasePage,
  NotionClient,
  RichTextItemResponse,
} from "../api/notion.ts";
import { arrayFrom, shuffleArray } from "./utils.ts";

const configData = await config({ safe: true, defaults: undefined });
const notionApi = new NotionClient(configData["NOTION_TOKEN"]);
const trelloApi = new TrelloClient(
  configData["TRELLO_APP_KEY"],
  configData["TRELLO_TOKEN"],
);

/**
 * Consume the iterable of Notion blocks until reaching a heading with the given text.
 * @param parentId Id of a Notion page.
 * @param searchTerm Search term as regular expression.
 */
async function findHeading(parentId: string, searchTerm: RegExp) {
  for await (const block of notionApi.blockChildren(parentId)) {
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
async function extractShoppingListItems(recipeId: string) {
  const listHeading = await findHeading(recipeId, /shopping list/i);
  if (!listHeading) {
    // No shopping list
    return [];
  }

  // Get the ingredients in a block
  const ingredients: { rich_text: RichTextItemResponse[] }[] = [];
  for await (const block of notionApi.blockChildren(recipeId, listHeading.id)) {
    if (block.id === listHeading.id) {
      continue;
    }

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
 * Extract all the recipes from Notion pages.
 */
function getAllRecipes(databaseId: string) {
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
    try {
      await trelloApi.createAttachmentOnCard(card.id, {
        url: recipe.cover.external.url,
        setCover: true,
      });
    } catch (error) {
      console.warn(
        "Failed to add cover to card",
        card.name,
        recipe.cover,
        error,
      );
    }
  }
}

async function addIngredientsAsCard(recipes: DatabasePage[], idList: string) {
  const shoppingListItems = Promise.all(
    recipes.map((recipe) => extractShoppingListItems(recipe.id)),
  )
    // Merge shopping list items
    .then((items) => items.flat());

  await trelloApi.archiveAllCardsInList(idList);
  const card = await trelloApi.createCard({
    idList,
    name: "Grocery List",
  });
  const checklist = await trelloApi.createChecklistOnCard(card.id);

  for (const shoppingListItem of await shoppingListItems) {
    await trelloApi.createCheckItems(checklist.id, shoppingListItem);
  }

  console.log("Set grocery list");
}

async function assignRecipesToLists(databaseId: string, boardId: string) {
  const [recipes, { groceryList, weekdays }] = await Promise.all([
    getAllRecipes(databaseId),
    getRecipeLists(boardId),
  ]);

  const recipesOfTheWeek = shuffleArray(recipes).slice(0, weekdays.length * 2);
  console.log("Selected recipes");

  const groceryListDone = addIngredientsAsCard(
    recipesOfTheWeek,
    groceryList.id,
  );

  // Create 2 cards for each of the weekdays for lunch and dinner.
  await Promise.all(weekdays.map(async (weekday, index) => {
    await trelloApi.archiveAllCardsInList(weekday.id);

    const lunchIndex = index * 2;
    const dinnerIndex = (index * 2) + 1;

    await addRecipeAsCard(recipesOfTheWeek[lunchIndex], weekday.id);
    await addRecipeAsCard(recipesOfTheWeek[dinnerIndex], weekday.id);
    console.log(`Set ${weekday.name}`);
  }));

  // Create a card for grocery list.
  await groceryListDone;
}

await assignRecipesToLists(
  configData["NOTION_DB"],
  configData["TRELLO_BOARD_ID"],
);
