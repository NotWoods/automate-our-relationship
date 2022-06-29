import { TrelloClient } from './trello.js';

// https://www.npmjs.com/package/trello-node-api
const trello = new TrelloClient(
  process.env['TRELLO_APP_KEY']!,
  process.env['TRELLO_TOKEN']!,
);

export async function getRecipeLists(boardId: string) {
  const [groceryList, ...weekdays] = await trello.boards.lists(boardId);
  if (weekdays.length !== 7 && weekdays.length !== 5) {
    throw new Error(
      `Invalid board, expected 5 or 7 lists, got ${weekdays.length}`,
    );
  }

  return {
    groceryList,
    weekdays,
  };
}

export async function recipesOfTheWeek() {
  // const allRecipes = await allRecipes();
  return getRandomSubarray([], 12);
}

/*async function createRecipeCards() {
  const recipesOfTheWeek = await recipesOfTheWeek();
  recipesOfTheWeek.map((recipe) => {
    // Create 2 cards each day

    let data = {};
  });
}*/

/**
 * Shuffling a copy of the array using the Fisher-Yates shuffle
 * https://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
 */
function getRandomSubarray<T>(arr: readonly T[], size: number) {
  let shuffled = arr.slice(0);
  let i = arr.length;
  let temp;
  let index;
  while (i--) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(0, size);
}
