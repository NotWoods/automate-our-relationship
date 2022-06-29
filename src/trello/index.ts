import { allRecipes } from '../index';
import { FullQueryDatabaseResult } from '../notion/types';
import * as TrelloNodeAPI from 'trello-node-api';

// https://www.npmjs.com/package/trello-node-api
const trello = new TrelloNodeAPI();
trello.setApiKey('TRELLO_APP_KEY');
trello.setOauthToken('TRELLO_TOKEN');

function searchRecipeBoard() {
  trello.board.search('TRELLO_BOARD_ID').then(function (response) {
    console.log('response ', response);
  }).catch(function (error) {
    console.log('error', error);
  });
}

async function recipesOfTheWeek() : Promise<FullQueryDatabaseResult[]> {
  const allRecipes = await allRecipes()
  return getRandomSubarray(allRecipes, 12);
}

async function createRecipeCards() {
  const recipesOfTheWeek = await recipesOfTheWeek()
  recipesOfTheWeek.map(recipe => {
    // Create 2 cards each day

    let data = {
    }

  })
}


// Shuffling a copy of the array using the Fisher-Yates shuffle
// https://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
function getRandomSubarray(arr, size) {
  let shuffled = arr.slice(0), i = arr.length, temp, index;
  while (i--) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(0, size);
}
