# automate-our-relationship/server

[Deno Deploy](https://deno.com/deploy) server to run some of the scripts in this
repo as webhooks instead.

```sh
# from repo root
deployctl deploy --entrypoint=server/main.ts --env-file
```
