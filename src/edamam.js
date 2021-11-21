import fetch from 'node-fetch';
const BASE_URL = new URL('https://api.edamam.com/');
export class EdamamClient {
    app_id;
    app_key;
    constructor(options) {
        this.app_id = options.app_id;
        this.app_key = options.app_key;
    }
    nutrition = {
        async fullRecipe(body, options) {
            const url = new URL('/api/nutrition-details', BASE_URL);
            if (options.force) {
                url.searchParams.set('force', options.force.toString());
            }
            const response = await fetch(url.toString(), {
                method: 'post',
                body: JSON.stringify(body),
            });
            if (response.ok) {
                return await response.json();
            }
            else {
                throw new Error(`Edamam error ${response.status}`);
            }
        },
    };
}
//# sourceMappingURL=edamam.js.map