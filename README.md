# How we automated our relationship

_Tiger Oakes ([@not_woods](https://twitter.com/Not_Woods)) x Daphne Liu ([@thebetterdaphne](https://twitter.com/thebetterdaphne))_

Want to automate your home? Come learn how to sharpen your skills in Node, APIs, and the Internet of Things while making laundry, cooking, & calendar projects that improve your life and relationship. Resources from our talk at [CascadiaJS 2022](https://2022.cascadiajs.com/speakers/tiger-oakes).

- [Slides](https://docs.google.com/presentation/d/1f2aMU0tW67sW15dOVwZzcDyae4ecegtwYerq_KiTiNM/edit?usp=sharing)

## Recipes 🍎

We got tired of putting together a grocery list every week since we have a backlog of go-to recipes. Instead of spending the weekend planning what we’re eating during the week, we wrote a script to automatically pull from our recipe list in Notion, assign meals onto days in our calendar, then add the ingredients onto our grocery list.

- [Our recipe boards on Notion (recipes.tigerxdaphne.com)](https://tigeroakes.notion.site/849553e394454ca9951006edd3bdcfd9?v=61420e4d89e144289d58393786d743a5)
  - Notion database key is `849553e394454ca9951006edd3bdcfd9`
- [Our source code](https://github.com/NotWoods/automate-our-relationship/tree/main/notion-recipe-randomizer)

## Meetings 📅

We share a home office. It’s the worst when we accidentally talk over each other in conflicting meetings. We’ll show you how to connect your meeting calendars to lights in your office, so you can quickly tell if someone’s in a call.

- [Home Assistant](https://www.home-assistant.io/)
- [Node-RED](https://nodered.org/)
- [Node-RED addon for Home Assistant](https://github.com/hassio-addons/addon-node-red)
- [Our Node-RED flows](https://github.com/NotWoods/automate-our-relationship/blob/main/node-red-flows.json)
  - [How to import flows in Node-RED](https://nodered.org/docs/user-guide/editor/workspace/import-export)

## Laundry 👗

We’re guilty of running and forgetting our laundry machine. Setting a timer is boring; we’re software engineers and we can do better. So, we attached a vibration sensor to track when the machine is running! We’ll demonstrate how to plug in that sensor to a speaker, to notify you when the laundry’s done.

- [Aqara Vibration Sensor](https://amazon.com/Aqara-Sensor/dp/B07PJT939B)
- [Zigbee USB Hub](https://amazon.com/Zigbee-USB-Hub/dp/B09KXTCMSC)
- [Our Node-RED flows](https://github.com/NotWoods/automate-our-relationship/blob/main/node-red-flows.json)
  - [How to import flows in Node-RED](https://nodered.org/docs/user-guide/editor/workspace/import-export)
