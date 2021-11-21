import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { EdamamClient } from './edamam.js';
config();
// https://github.com/makenotion/notion-sdk-js
const notion = new Client({
    auth: process.env['NOTION_TOKEN'],
});
const edamam = new EdamamClient({
    app_id: process.env['EDAMAM_APP_ID'],
    app_key: process.env['EDAMAM_APP_KEY'],
});
async function recipeStats() {
    const myPage = await notion.databases.query({
        database_id: '897e5a76-ae52-4b48-9fdf-e71f5945d1af',
        filter: {
            property: 'Landmark',
            text: {
                contains: 'Bridge',
            },
        },
    });
    // TODO write program here
    // get every recipe
    // for each recipe (or in parallel)
    // .. get the ingredients as an array
    // .. give those ingredients to edamam
    // .. store the result in a notion property? or print? dunno
    // celebrate and kiss tiger
}
recipeStats();
//# sourceMappingURL=index.js.map