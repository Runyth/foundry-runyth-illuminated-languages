// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { HandlebarsApplicationV2 } from "./base.js";
import { MODULE_ID, PLAIN_LANGUAGE, SETTINGS } from "../constants.js";
import { getPageMetadata, setPageMetadata } from "../journals/metadata.js";
import { documentApplicationId, pickGeometry, restoreGeometry } from "./geometry.js";

export class PageLanguageApp extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-page-language`,
    tag: "form",
    classes: [MODULE_ID, "page-language-app"],
    position: { width: 460, height: "auto" },
    window: { title: "ILLUMINATED_LANGUAGES.App.PageLanguage.Title", resizable: true },
    form: { handler: PageLanguageApp.onSubmit, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/page-language.hbs` }
  };

  constructor({ page, runtime, ...options } = {}) {
    const geometry = restoreGeometry(runtime?.settings?.get?.(SETTINGS.PAGE_LANGUAGE_GEOMETRY) ?? {}, {
      minimumWidth: 360,
      minimumHeight: 220
    });
    super({
      ...options,
      id: documentApplicationId(`${MODULE_ID}-page-language`, page?.uuid),
      position: { ...geometry, ...(options.position ?? {}) }
    });
    this.page = page;
    this.runtime = runtime;
  }

  _onPosition(position) {
    super._onPosition?.(position);
    void this.runtime?.executor?.run?.(
      "page-language.geometry",
      () => this.runtime.settings.set(SETTINGS.PAGE_LANGUAGE_GEOMETRY, pickGeometry(position)),
      { componentId: "page-language" },
      false
    );
  }

  async _prepareContext() {
    const metadata = getPageMetadata(this.page, {
      language: this.runtime.settings.get(SETTINGS.DEFAULT_LANGUAGE),
      languageNameVisibility: this.runtime.settings.get(SETTINGS.NAME_VISIBILITY),
      unreadableFallback: this.runtime.settings.get(SETTINGS.UNREADABLE_FALLBACK)
    });
    return {
      pageName: this.page?.name,
      metadata,
      languages: [
        { id: PLAIN_LANGUAGE, label: this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Plain") },
        ...this.runtime.adapter.getLanguages()
      ],
      visibilityOptions: this.runtime.visibilityOptions(),
      fallbackOptions: this.runtime.fallbackOptions()
    };
  }

  static async onSubmit(event, form, formData) {
    const data = formData?.object ?? Object.fromEntries(new FormData(form));
    await setPageMetadata(this.page, {
      schemaVersion: 1,
      enabled: data.enabled === true || data.enabled === "true" || data.enabled === "on",
      language: data.language,
      requireLiteracy: data.requireLiteracy === true || data.requireLiteracy === "true" || data.requireLiteracy === "on",
      languageNameVisibility: data.languageNameVisibility,
      unreadableFallback: data.unreadableFallback
    });
    await this.runtime.rerenderOpenViews(this.page.uuid);
  }
}
