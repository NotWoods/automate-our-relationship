import type {
  BlockObjectResponse,
  HeadingBlockObjectResponse,
  RichTextObjectResponse,
} from './types';

const headingTypes = {
  heading_1: 1,
  heading_2: 2,
  heading_3: 3,
} as const;

export function formatText(
  textBlocks: ReadonlyArray<{ plain_text: string }>,
): string {
  return textBlocks.map((block) => block.plain_text).join('');
}

/**
 * Gets the index of a block that is both a heading and contains the given text.
 * @param blocks List of blocks from a Notion page.
 * @param searchTerm Search term as regular expression.
 */
export function findHeadingIndex(
  blocks: readonly BlockObjectResponse[],
  searchTerm: RegExp,
) {
  return blocks.findIndex((block) => {
    let richText: RichTextObjectResponse;
    switch (block.type) {
      case 'heading_1':
        richText = block.heading_1;
        break;
      case 'heading_2':
        richText = block.heading_2;
        break;
      case 'heading_3':
        richText = block.heading_3;
        break;
      default:
        return false;
    }

    return richText.rich_text.some((block) =>
      searchTerm.test(block.plain_text),
    );
  });
}

/**
 * Extract the list item blocks, given the index of the list's header.
 */
export function extractListItems(
  blocks: readonly BlockObjectResponse[],
  listHeaderIndex: number,
) {
  const heading = blocks[listHeaderIndex] as HeadingBlockObjectResponse;
  const parentHeadingLevel = headingTypes[heading.type];
  if (parentHeadingLevel === undefined) {
    console.warn(heading);
    throw new Error(`Invalid heading block, found ${heading.type}`);
  }

  // Get the ingredients in a block
  const ingredients: RichTextObjectResponse[] = [];
  for (let i = listHeaderIndex + 1; i < blocks.length; i++) {
    const block = blocks[i];

    let continueLoop = true;
    switch (block.type) {
      // Add list items to result list
      case 'bulleted_list_item':
        ingredients.push(block.bulleted_list_item);
        break;
      case 'to_do':
        ingredients.push(block.to_do);
        break;
      // Break when entering a new heading at the same or above level
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        const thisHeadingLevel = headingTypes[block.type];
        if (thisHeadingLevel <= parentHeadingLevel) {
          continueLoop = false;
        }
        break;
      case 'paragraph':
        // just skip paragraphs, usually subheaders or empty lines
        break;
      default:
        console.warn('found weird item in shopping list', block);
        continueLoop = false;
        break;
    }

    if (!continueLoop) break;
  }

  return ingredients;
}
