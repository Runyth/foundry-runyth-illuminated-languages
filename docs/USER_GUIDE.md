# User guide

## Installation

1. Install and enable Polyglot 2.8.3 or a compatible newer 2.8.x patch release in a Foundry VTT V13 world.
2. Extract `runyth-illuminated-languages-v1.0.7.zip` into the Foundry Data modules directory.
3. Enable **Illuminated Languages**.
4. Optionally enable Illuminated Documents 1.9.0 or newer.

## Reading

When a protected journal or illuminated document opens, the module resolves one reading actor. If that actor can read the assigned language, the original text remains visible. Otherwise the client displays Polyglot script. The same document may therefore look different in different browsers.

Use the compact **Read as…** selector when more than one legitimate actor is available. Selecting **Automatic** restores deterministic actor resolution.

## Language labels

The document can reveal the language always, only when recognized, only to the GM, or not at all. Hidden labels do not place the language ID in tooltips, ARIA labels, CSS classes, or player-facing diagnostics.

## GM preview modes

Open the document in view/reading mode and use the **GM Language Preview** toolbar at the top of its rendered content. Choose an actor, a connected player's resolved reading actor, or a viewer with no language knowledge. On ordinary Journal pages, the eye action **Language Preview…** in the page header opens the same choices. These modes are local previews only. **View Original** restores the normal GM source view.
