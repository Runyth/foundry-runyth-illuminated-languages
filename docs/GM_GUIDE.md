# GM guide

## Assign an ordinary journal language

Open a text page and choose **Language settings** from its ApplicationV2 header. Enable language rendering, select a Polyglot language, choose whether literacy is required, and choose language-name visibility.

## Assign Illuminated Documents languages

With Illuminated Documents 1.9.0 active, its public extension framework displays **Document Language** and **Block Language** fields. A block can inherit, use Plain, or override the document with another Polyglot language.

## Language preview — where to find it

The GM sees source text by default. To change the preview perspective:

1. Open an ordinary Journal text page or an Illuminated Document in **view/reading mode**, not its editor.
2. Look at the **top of the rendered document content** for the clearly titled **GM Language Preview** toolbar.
3. Choose a player, actor, or **Preview with no language knowledge** from **Preview perspective**.
4. Use the toolbar's **View Original** button to restore normal GM text.

For an ordinary Journal page, the same selector can also be opened from the page header's eye action named **Language Preview…**. Illuminated Documents use the visible in-document toolbar because their integration is intentionally limited to the public rendered-document extension pipeline.

Available GM preview choices are:

- **Actor** — use that actor's actual Polyglot literacy and temporary comprehension.
- **Player: name — actor** — use the connected player's deterministically resolved reading actor and player-facing language-name visibility.
- **Preview with no language knowledge** — force every protected language unreadable and unrecognized, even if a provider would normally grant comprehension. Plain / universally readable content remains readable.
- **View Original** — restore the authoritative GM view.

Preview state is client-scoped. It never alters another browser, document metadata, source text, actor data, or player permissions.

A connected-player preview uses information the GM client can legitimately resolve: the player's assigned character, or exactly one owned player character. A different explicit **Read as…** choice stored only in the player's browser cannot be inspected by the GM client.

## Reader comparison

**Compare readers** lists connected non-GM users, their resolved reading actor, and the current page's readable/unreadable result. It is GM-only and does not expose hidden actor data to players.

## Bulk management

Open Configure Settings → Illuminated Languages → **Open bulk manager**. Select journal pages, choose language and visibility, review the count, and confirm. Missing IDs are preserved until explicitly replaced.

## Maintenance

The settings application can validate metadata, migrate schemas, clear caches, rerender views, copy diagnostics, and run a non-destructive integration self-test.
