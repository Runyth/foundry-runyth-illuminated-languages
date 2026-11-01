// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { HandlebarsApplicationV2 } from "./base.js";
import { MODULE_ID, SETTINGS } from "../constants.js";
import { getPageMetadata } from "../journals/metadata.js";
import { documentApplicationId, pickGeometry, restoreGeometry } from "./geometry.js";

export class ReaderComparisonApp extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-comparison`,
    classes: [MODULE_ID, "comparison-app"],
    position: { width: 680, height: 560 },
    window: { title: "ILLUMINATED_LANGUAGES.App.Comparison.Title", resizable: true }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/comparison.hbs` }
  };

  constructor({ runtime, page, ...options } = {}) {
    const geometry = restoreGeometry(runtime?.settings?.get?.(SETTINGS.COMPARISON_GEOMETRY) ?? {}, {
      minimumWidth: 420,
      minimumHeight: 280
    });
    super({
      ...options,
      id: documentApplicationId(`${MODULE_ID}-comparison`, page?.uuid),
      position: { ...geometry, ...(options.position ?? {}) }
    });
    this.runtime = runtime;
    this.page = page;
  }

  _onPosition(position) {
    super._onPosition?.(position);
    void this.runtime?.executor?.run?.(
      "comparison.geometry",
      () => this.runtime.settings.set(SETTINGS.COMPARISON_GEOMETRY, pickGeometry(position)),
      { componentId: "comparison" },
      false
    );
  }

  async _prepareContext() {
    const metadata = getPageMetadata(this.page);
    const users = await Promise.all((globalThis.game?.users?.contents ?? [])
      .filter((user) => !user.isGM)
      .map(async (user) => {
        const resolution = this.runtime.resolver.resolveForConnectedUser(user.id);
        const actor = this.runtime.resolver.getActor(resolution);
        const result = await this.runtime.engine.resolve({
          actor,
          languageId: metadata.language,
          requireLiteracy: metadata.requireLiteracy,
          user,
          context: { documentUuid: this.page.parent?.uuid, pageUuid: this.page.uuid, originalView: false }
        });
        return {
          userName: user.name,
          actorName: resolution.actorName ?? this.runtime.localize("ILLUMINATED_LANGUAGES.Controls.NoActor"),
          result: result.readable
            ? this.runtime.localize("ILLUMINATED_LANGUAGES.Results.Readable")
            : this.runtime.localize("ILLUMINATED_LANGUAGES.Results.Unreadable")
        };
      }));
    return {
      pageName: this.page.name,
      language: this.runtime.adapter.getLanguageLabel(metadata.language),
      users
    };
  }
}
