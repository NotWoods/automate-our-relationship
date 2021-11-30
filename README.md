# notion-recipe-stats

Small script to figure out Fiber (or other nutrition info) for recipes stored in Notion. The [Edamam Nutrition Analysis API](https://developer.edamam.com/edamam-nutrition-api-demo) is used to parse the recipes and return nutrition labels.

## Notion database

This script is designed to work with a Notion database containing recipes, where each page in the database has text that includes a list of ingredients under a "Shopping List" header. The current filters in the script check for a "Rotation" tag in the "Tags" property and set the "Fiber" number property. Fiber is represented in grams, and it would be nice if Notion let me add a custom suffix to numbers.

## Setup

Clone the repository and install Node.js dependencies using `npm install`. Create a `.env` file where API keys will be stored.

```sh
git clone https://github.com/NotWoods/notion-recipe-stats.git
cd notion-recipe-stats
npm install
echo "" > .env
```

### Edamam

Set up an account with Edamam and find the App ID and App key in your dashboard. Add the following lines to `.env`:

```shell
# .env
EDAMAM_APP_ID=<app_id>
EDAMAM_APP_KEY=<app_key>
```

### Notion

Set up a Notion internal app, then copy the API token from notion into `.env`:

```shell
# .env
NOTION_TOKEN=<api_token>
```

Open up your recipe database and invite your new app using the "Share" menu. Additionally, copy the database ID from the URL.

```
https://www.notion.so/tigeroakes/849553e394454ca9951006edd3bdcfd9?v=61420e4d89e144289d58393786d743a5
                                 <         database id          >   <           view id            >
```

Add the database ID to `.env`:

```shell
# .env
NOTION_DB=<database_id>
```

## Running

Run `npm start` to compile the TypeScript code and run the Node.js program.
