import { router } from "https://deno.land/x/rutt@0.2.0/mod.ts";
import { randomizeRecipes } from "../notion-recipe-randomizer/script.ts";

const server = Deno.serve(
  router({
    "/run/recipe-randomizer": async (request) => {
      const url = new URL(request.url);
      await randomizeRecipes({
        mergeIngredients: url.searchParams.has("ingredients"),
      });

      return new Response("Hello world!", { status: 200 });
    },
  }),
);

await server.finished;
