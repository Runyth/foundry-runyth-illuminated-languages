// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { HandlebarsApplicationV2 } from "./base.js";
import { MODULE_ID, SETTINGS } from "../constants.js";
import { pickGeometry, restoreGeometry } from "./geometry.js";

export class IlluminatedLanguagesSettingsApp extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-settings`,
    tag: "form",
    classes: [MODULE_ID, "settings-app"],
    position: { width: 720, height: 740 },
    window: { title: "ILLUMINATED_LANGUAGES.App.Settings.Title", resizable: true },
    actions: {
      validate: IlluminatedLanguagesSettingsApp.validate,
      migrate: IlluminatedLanguagesSettingsApp.migrate,
      clearCaches: IlluminatedLanguagesSettingsApp.clearCaches,
      rerender: IlluminatedLanguagesSettingsApp.rerender,
      diagnostics: IlluminatedLanguagesSettingsApp.copyDiagnostics,
      selfTest: IlluminatedLanguagesSettingsApp.selfTest,
      bulk: IlluminatedLanguagesSettingsApp.openBulk,
      resetGeometry: IlluminatedLanguagesSettingsApp.resetGeometry
    },
    form: { handler: IlluminatedLanguagesSettingsApp.onSubmit, closeOnSubmit: false }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/settings.hbs` }
  };

  constructor({ runtime, ...options } = {}) {
    const resolvedRuntime = runtime ?? globalThis.game?.illuminatedLanguages?.runtime;
    const geometry = restoreGeometry(resolvedRuntime?.settings?.get?.(SETTINGS.SETTINGS_GEOMETRY) ?? {}, {
      minimumWidth: 480,
      minimumHeight: 360
    });
    super({ ...options, position: { ...geometry, ...(options.position ?? {}) } });
    this.runtime = resolvedRuntime;
    this.lastResult = null;
    this.savedScrollTop = 0;
  }

  _onPosition(position) {
    super._onPosition?.(position);
    void this.runtime?.executor?.run?.(
      "settings.geometry",
      () => this.runtime.settings.set(SETTINGS.SETTINGS_GEOMETRY, pickGeometry(position)),
      { componentId: "settings" },
      false
    );
  }


  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element?.querySelector?.(".runyth-illuminated-languages-settings");
    if (root && Number.isFinite(this.savedScrollTop)) root.scrollTop = this.savedScrollTop;
  }

  captureScroll() {
    const value = this.element?.querySelector?.(".runyth-illuminated-languages-settings")?.scrollTop;
    if (Number.isFinite(value)) this.savedScrollTop = value;
  }

  async _prepareContext() {
    const values = {};
    for (const key of Object.values(SETTINGS)) values[key] = this.runtime.settings.get(key);
    const polyglot = this.runtime.adapter.getDiagnostics();
    const illuminatedDocuments = this.runtime.idocIntegration.getDiagnostics();
    return {
      values,
      isGM: Boolean(globalThis.game?.user?.isGM),
      polyglot,
      illuminatedDocuments,
      integrationRows: this.#integrationRows(polyglot, illuminatedDocuments),
      languages: [
        { id: "__plain__", label: this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Plain") },
        ...this.runtime.adapter.getLanguages()
      ],
      languageLabelOptions: [
        { id: "display", label: this.runtime.localize("ILLUMINATED_LANGUAGES.Settings.LanguageLabelDisplay") },
        { id: "display-and-id", label: this.runtime.localize("ILLUMINATED_LANGUAGES.Settings.LanguageLabelDisplayAndId") },
        { id: "id", label: this.runtime.localize("ILLUMINATED_LANGUAGES.Settings.LanguageLabelId") }
      ],
      visibilityOptions: this.runtime.visibilityOptions(),
      fallbackOptions: this.runtime.fallbackOptions(),
      diagnostics: JSON.stringify(this.runtime.getDiagnostics(), null, 2),
      lastResult: this.lastResult
    };
  }

  #integrationRows(polyglot, illuminatedDocuments) {
    const rows = [
      ["ILLUMINATED_LANGUAGES.Diagnostics.PolyglotInstalled", polyglot.installed],
      ["ILLUMINATED_LANGUAGES.Diagnostics.PolyglotActive", polyglot.active],
      ["ILLUMINATED_LANGUAGES.Diagnostics.PolyglotVersion", polyglot.version],
      ["ILLUMINATED_LANGUAGES.Diagnostics.Provider", polyglot.provider],
      ["ILLUMINATED_LANGUAGES.Diagnostics.LanguageCount", polyglot.languageCount],
      ["ILLUMINATED_LANGUAGES.Diagnostics.Compatibility", polyglot.compatible],
      ["ILLUMINATED_LANGUAGES.Diagnostics.IdocInstalled", illuminatedDocuments.installed],
      ["ILLUMINATED_LANGUAGES.Diagnostics.IdocApi", illuminatedDocuments.apiVersion],
      ["ILLUMINATED_LANGUAGES.Diagnostics.Registration", illuminatedDocuments.registered],
      ["ILLUMINATED_LANGUAGES.Diagnostics.LastError", illuminatedDocuments.lastError]
    ];
    return rows.map(([label, value]) => ({ label, value: this.#diagnosticValue(value) }));
  }

  #diagnosticValue(value) {
    if (typeof value === "boolean") {
      return this.runtime.localize(value
        ? "ILLUMINATED_LANGUAGES.Common.Yes"
        : "ILLUMINATED_LANGUAGES.Common.No");
    }
    if (value === null || value === undefined || value === "") {
      return this.runtime.localize("ILLUMINATED_LANGUAGES.Common.NotAvailable");
    }
    if (typeof value === "object") {
      if (value.localizationKey) return this.runtime.localize(value.localizationKey);
      return value.message ?? value.code ?? JSON.stringify(value);
    }
    return String(value);
  }

  static async onSubmit(event, form, formData) {
    this.captureScroll?.();
    const data = formData?.object ?? Object.fromEntries(new FormData(form));
    const booleanKeys = new Set([
      SETTINGS.REQUIRE_LITERACY,
      SETTINGS.SPOKEN_AS_LITERATE,
      SETTINGS.GM_ORIGINAL_VIEW,
      SETTINGS.USE_EXPLICIT,
      SETTINGS.USE_CONTROLLED,
      SETTINGS.USE_ASSIGNED,
      SETTINGS.USE_OWNED,
      SETTINGS.REMEMBER_SELECTION,
      SETTINGS.USE_POLYGLOT_FONTS,
      SETTINGS.SHOW_BADGE
    ]);
    const numberKeys = new Set([SETTINGS.SCRIPT_SCALE, SETTINGS.LINE_HEIGHT]);
    const isGM = Boolean(globalThis.game?.user?.isGM);
    for (const [key, value] of Object.entries(data)) {
      if (!EDITABLE_CLIENT_KEYS.has(key) && !(isGM && EDITABLE_WORLD_KEYS.has(key))) continue;
      const normalized = booleanKeys.has(key)
        ? value === true || value === "true" || value === "on"
        : numberKeys.has(key) ? Number(value) : value;
      await this.runtime.settings.set(key, normalized);
    }
    await this.runtime.invalidateDocument();
    this.lastResult = { message: this.runtime.localize?.("ILLUMINATED_LANGUAGES.Results.SettingsSaved") ?? "ILLUMINATED_LANGUAGES.Results.SettingsSaved" };
    await this.render({ force: true });
  }

  static async validate() {
    this.captureScroll?.();
    assertGm();
    this.lastResult = await this.runtime.validateAllMetadata();
    await this.render({ force: true });
  }

  static async migrate() {
    this.captureScroll?.();
    assertGm();
    this.lastResult = await this.runtime.migrations.migrateAll({ force: true });
    await this.render({ force: true });
  }

  static async clearCaches() {
    this.captureScroll?.();
    this.runtime.clearCaches();
    this.lastResult = { cleared: true };
    await this.render({ force: true });
  }

  static async rerender() {
    this.captureScroll?.();
    this.lastResult = { rerendered: await this.runtime.rerenderOpenViews() };
    await this.render({ force: true });
  }

  static async copyDiagnostics() {
    this.captureScroll?.();
    const text = JSON.stringify(this.runtime.getDiagnostics(), null, 2);
    await globalThis.navigator?.clipboard?.writeText?.(text);
    this.lastResult = { copied: true };
    await this.render({ force: true });
  }

  static async selfTest() {
    this.captureScroll?.();
    this.lastResult = await this.runtime.runSelfTest();
    await this.render({ force: true });
  }

  static async resetGeometry() {
    this.captureScroll?.();
    for (const key of [
      SETTINGS.SETTINGS_GEOMETRY,
      SETTINGS.BULK_GEOMETRY,
      SETTINGS.PAGE_LANGUAGE_GEOMETRY,
      SETTINGS.COMPARISON_GEOMETRY
    ]) await this.runtime.settings.set(key, {});
    this.lastResult = { message: this.runtime.localize?.("ILLUMINATED_LANGUAGES.Results.GeometryReset") ?? "ILLUMINATED_LANGUAGES.Results.GeometryReset" };
    await this.render({ force: true });
  }

  static openBulk() {
    assertGm();
    return this.runtime.openBulkManager();
  }
}

const EDITABLE_WORLD_KEYS = new Set([
  SETTINGS.DEFAULT_LANGUAGE,
  SETTINGS.LANGUAGE_LABEL_MODE,
  SETTINGS.REQUIRE_LITERACY,
  SETTINGS.SPOKEN_AS_LITERATE,
  SETTINGS.NAME_VISIBILITY,
  SETTINGS.UNREADABLE_FALLBACK,
  SETTINGS.NO_ACTOR_BEHAVIOUR
]);

const EDITABLE_CLIENT_KEYS = new Set([
  SETTINGS.GM_ORIGINAL_VIEW,
  SETTINGS.USE_EXPLICIT,
  SETTINGS.USE_CONTROLLED,
  SETTINGS.USE_ASSIGNED,
  SETTINGS.USE_OWNED,
  SETTINGS.REMEMBER_SELECTION,
  SETTINGS.MULTIPLE_CONTROLLED,
  SETTINGS.USE_POLYGLOT_FONTS,
  SETTINGS.SCRIPT_SCALE,
  SETTINGS.LINE_HEIGHT,
  SETTINGS.SHOW_BADGE
]);

function assertGm() {
  if (!globalThis.game?.user?.isGM) throw new Error("GM permission is required.");
}

