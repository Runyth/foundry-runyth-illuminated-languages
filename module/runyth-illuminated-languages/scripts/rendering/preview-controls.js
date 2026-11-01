// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export class PreviewControls {
  constructor({ gameRef = () => globalThis.game, preview, resolver, adapter, executor = null, localize = (key) => key, rerender = async () => 0 } = {}) {
    this.gameRef = gameRef;
    this.preview = preview;
    this.resolver = resolver;
    this.adapter = adapter;
    this.executor = executor;
    this.localize = localize;
    this.rerender = rerender;
  }

  render(root, { metadata = {}, transformResult = null } = {}) {
    if (!root?.ownerDocument?.createElement) return;
    root.querySelector?.(":scope > .runyth-illuminated-languages-controls")?.remove?.();

    const isGM = Boolean(this.gameRef()?.user?.isGM);
    const options = this.preview.getOptions();
    if (!isGM && options.filter((option) => option.group === "actors").length <= 1) return;

    const document = root.ownerDocument;
    const state = this.preview.getState();
    const wrapper = document.createElement("section");
    wrapper.className = `runyth-illuminated-languages-controls ${isGM ? "runyth-illuminated-languages-gm-preview" : "runyth-illuminated-languages-reader-control"}`;
    wrapper.dataset.illuminatedLanguageIgnore = "true";
    wrapper.dataset.previewMode = isGM ? state.mode : "reader";
    wrapper.setAttribute("role", "region");

    const heading = document.createElement("div");
    heading.className = "runyth-illuminated-languages-controls-heading";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-eye";
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = this.localize(isGM
      ? "ILLUMINATED_LANGUAGES.Controls.GmPreviewTitle"
      : "ILLUMINATED_LANGUAGES.Controls.ReaderTitle");
    heading.append(icon, title);
    wrapper.append(heading);
    wrapper.setAttribute("aria-label", title.textContent);

    const hint = document.createElement("p");
    hint.className = "runyth-illuminated-languages-controls-hint";
    hint.textContent = this.localize(isGM
      ? "ILLUMINATED_LANGUAGES.Controls.GmPreviewHint"
      : "ILLUMINATED_LANGUAGES.Controls.ReaderHint");
    wrapper.append(hint);

    const row = document.createElement("div");
    row.className = "runyth-illuminated-languages-controls-row";
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.className = "runyth-illuminated-languages-controls-label";
    labelText.textContent = this.localize(isGM
      ? "ILLUMINATED_LANGUAGES.Controls.PreviewPerspective"
      : "ILLUMINATED_LANGUAGES.Controls.ReadAs");
    const select = document.createElement("select");
    select.setAttribute("aria-label", labelText.textContent);

    for (const optionData of options) {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = this.optionLabel(optionData);
      select.append(option);
    }

    select.value = isGM
      ? state.value
      : this.resolver.resolve().source === "explicit"
        ? `actor:${this.resolver.resolve().actorId ?? ""}`
        : "";
    select.addEventListener("change", () => {
      void this.#run("preview.selection", async () => {
        await this.preview.applySelection(select.value);
        await this.rerender();
      });
    });
    label.append(labelText, select);
    row.append(label);

    if (isGM && state.mode !== "original") {
      const originalButton = document.createElement("button");
      originalButton.setAttribute("type", "button");
      originalButton.className = "runyth-illuminated-languages-view-original";
      originalButton.textContent = this.localize("ILLUMINATED_LANGUAGES.Controls.ViewOriginal");
      originalButton.addEventListener("click", () => {
        void this.#run("preview.original", async () => {
          await this.preview.setOriginal();
          await this.rerender();
        });
      });
      row.append(originalButton);
    }
    wrapper.append(row);

    if (isGM) {
      const status = document.createElement("span");
      status.className = "runyth-illuminated-languages-preview-state";
      status.textContent = state.mode === "original"
        ? this.localize("ILLUMINATED_LANGUAGES.Controls.OriginalState")
        : this.#statusText(state, metadata, transformResult);
      status.setAttribute("role", "status");
      wrapper.append(status);
    }

    root.prepend?.(wrapper);
  }

  optionLabel(option) {
    if (option.label === "automatic") return this.localize("ILLUMINATED_LANGUAGES.Controls.Automatic");
    if (option.label === "original") return this.localize("ILLUMINATED_LANGUAGES.Controls.ViewOriginal");
    if (option.label === "unreadable") return this.localize("ILLUMINATED_LANGUAGES.Controls.PreviewNoLanguages");
    if (option.group === "players") {
      const actor = option.actorName ?? this.localize("ILLUMINATED_LANGUAGES.Controls.NoActor");
      return this.localize("ILLUMINATED_LANGUAGES.Controls.PlayerOption")
        .replace("{player}", option.label)
        .replace("{actor}", actor);
    }
    return option.label;
  }

  #run(operation, callback) {
    if (this.executor?.run) {
      return this.executor.run(operation, callback, { componentId: "preview-controls" }, false);
    }
    return Promise.resolve().then(callback).catch(() => false);
  }

  #statusText(state, metadata, transformResult) {
    if (state.mode === "player") {
      return this.localize("ILLUMINATED_LANGUAGES.Controls.PreviewPlayerState")
        .replace("{player}", state.userName ?? this.localize("ILLUMINATED_LANGUAGES.Controls.UnknownPlayer"))
        .replace("{actor}", state.actorName ?? this.localize("ILLUMINATED_LANGUAGES.Controls.NoActor"));
    }
    if (state.mode === "unreadable") return this.localize("ILLUMINATED_LANGUAGES.Controls.PreviewNoLanguagesState");

    const actorName = state.actorName ?? this.localize("ILLUMINATED_LANGUAGES.Controls.NoActor");
    const languageId = metadata.document ? null : metadata.language ?? metadata.defaultLanguage;
    if (!languageId) {
      return this.localize("ILLUMINATED_LANGUAGES.Controls.PreviewActorState").replace("{actor}", actorName);
    }
    const languageName = this.adapter?.getLanguageLabel?.(languageId) ?? languageId;
    const resultName = transformResult?.readable
      ? this.localize("ILLUMINATED_LANGUAGES.Results.Readable")
      : this.localize("ILLUMINATED_LANGUAGES.Results.Unreadable");
    return this.localize("ILLUMINATED_LANGUAGES.Controls.PreviewState")
      .replace("{actor}", actorName)
      .replace("{language}", languageName)
      .replace("{result}", resultName);
  }
}
