# Troubleshooting

## I cannot find the GM preview control

Open the document in **view/reading mode**. The control is the **GM Language Preview** toolbar at the top of the rendered document content. It is intentionally absent from source editors so transformed text cannot be saved. For ordinary Journal pages, also use the eye action **Language Preview…** in the page header. If the toolbar is still absent, verify that Illuminated Languages is active and reload the document after Foundry finishes its ready lifecycle.

## Protected text shows a dependency warning

Open Configure Settings → Illuminated Languages and inspect Polyglot installation, activation, version, provider, language count, and compatibility. The manifest requires Polyglot 2.8.3 or newer. Runtime compatibility is validated against the supported 2.8.x adapter contract, so compatible custom patch releases can enable normally.

## A player should read the language but cannot

Verify the resolved **Read as…** actor, actor ownership, Polyglot's known/literate language output, and the page's **Require written literacy** option. Run the self-test and copy diagnostics. Diagnostics omit source text.

## Several controlled tokens exist

Select one actor explicitly. The module intentionally refuses to merge multiple actors' knowledge.

## An imported language is unavailable

The original language ID is preserved and remains unreadable. Install or repair the relevant Polyglot provider, or use the bulk manager to remap it.

## Illuminated Documents fields are absent

Verify Illuminated Documents 1.9.0 or newer, extension API 1.x, and the registration status. The module does not fall back to private patches.

## A view did not update

Use **Rerender open documents**. Actor, ownership, effect, controlled-token, provider, and relevant setting changes normally invalidate only affected views.

## Token selection previously caused a stack overflow or read-only Actor

Install 1.0.5 or newer and reload the world. The resolver no longer stores or recursively freezes live Foundry documents. Confirm that the console contains no `deepFreeze` stack overflow, deprecated direct-sense warnings attributed to Illuminated Languages, or read-only Actor/Item errors after changing controlled tokens.
