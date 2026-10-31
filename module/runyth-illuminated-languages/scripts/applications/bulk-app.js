// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { HandlebarsApplicationV2 } from "./base.js";
import {
  INHERIT_LANGUAGE,
  MODULE_ID,
  PLAIN_LANGUAGE,
  SETTINGS
} from "../constants.js";
import { getPageMetadata, setPageMetadata, validatePageMetadata } from "../journals/metadata.js";
import { normalizeIlluminatedMetadata, validateIlluminatedMetadata } from "../validation/metadata.js";
import { pickGeometry, restoreGeometry } from "./geometry.js";

export class BulkLanguageApp extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-bulk`,
    tag: "form",
    classes: [MODULE_ID, "bulk-app"],
    position: { width: 940, height: 760 },
    window: { title: "ILLUMINATED_LANGUAGES.App.Bulk.Title", resizable: true },
    actions: {
      refresh: BulkLanguageApp.refresh,
      selectVisible: BulkLanguageApp.selectVisible,
      clearSelection: BulkLanguageApp.clearSelection
    },
    form: { handler: BulkLanguageApp.onSubmit, closeOnSubmit: false }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/bulk.hbs` }
  };

  constructor({ runtime, ...options } = {}) {
    const geometry = restoreGeometry(runtime?.settings?.get?.(SETTINGS.BULK_GEOMETRY) ?? {}, {
      minimumWidth: 560,
      minimumHeight: 420
    });
    super({ ...options, position: { ...geometry, ...(options.position ?? {}) } });
    this.runtime = runtime;
    this.result = null;
    this.filterController = null;
    this.uiState = { values: {}, selectedKeys: [], listScrollTop: 0, rootScrollTop: 0 };
    this.submitting = false;
  }

  _onPosition(position) {
    super._onPosition?.(position);
    void this.runtime?.executor?.run?.(
      "bulk.geometry",
      () => this.runtime.settings.set(SETTINGS.BULK_GEOMETRY, pickGeometry(position)),
      { componentId: "bulk" },
      false
    );
  }

  async _prepareContext() {
    const targets = await this.collectTargets();
    const folders = [...new Set(targets.map((target) => target.folderName).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
    return {
      targets,
      count: targets.length,
      folders,
      languages: [
        { id: INHERIT_LANGUAGE, label: this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Inherit") },
        { id: PLAIN_LANGUAGE, label: this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Plain") },
        ...this.runtime.adapter.getLanguages()
      ],
      visibilityOptions: this.runtime.visibilityOptions(),
      fallbackOptions: this.runtime.fallbackOptions(),
      result: this.result
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.filterController?.abort();
    this.filterController = new AbortController();
    const signal = this.filterController.signal;
    const element = this.element;
    if (!element?.querySelectorAll) return;
    for (const input of element.querySelectorAll("[data-bulk-filter]")) {
      input.addEventListener("input", () => this.applyFilters(), { signal });
      input.addEventListener("change", () => this.applyFilters(), { signal });
    }
    for (const checkbox of element.querySelectorAll(".bulk-row input[type='checkbox']")) {
      checkbox.addEventListener("change", () => this.updatePreviewCount(), { signal });
    }
    this.#restoreUiState();
    this.applyFilters();
  }

  captureUiState({ includeSelection = true } = {}) {
    const element = this.element;
    if (!element?.querySelectorAll) return;
    const values = {};
    for (const field of element.querySelectorAll("[name]")) {
      if (field.type === "checkbox") {
        if (!field.name.startsWith("target.")) values[field.name] = field.checked;
        continue;
      }
      values[field.name] = field.value;
    }
    const selectedKeys = includeSelection
      ? [...element.querySelectorAll(".bulk-row input[type='checkbox']:checked")].map((input) => input.name.slice(7))
      : [];
    this.uiState = {
      values,
      selectedKeys,
      listScrollTop: element.querySelector(".bulk-list")?.scrollTop ?? 0,
      rootScrollTop: element.querySelector(".runyth-illuminated-languages-bulk")?.scrollTop ?? 0
    };
  }

  #restoreUiState() {
    const element = this.element;
    if (!element?.querySelectorAll) return;
    for (const [name, value] of Object.entries(this.uiState.values ?? {})) {
      const field = element.querySelector(`[name='${cssEscape(name)}']`);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    }
    const selected = new Set(this.uiState.selectedKeys ?? []);
    for (const input of element.querySelectorAll(".bulk-row input[type='checkbox']")) {
      input.checked = selected.has(input.name.slice(7));
    }
    const list = element.querySelector(".bulk-list");
    if (list) list.scrollTop = this.uiState.listScrollTop ?? 0;
    const root = element.querySelector(".runyth-illuminated-languages-bulk");
    if (root) root.scrollTop = this.uiState.rootScrollTop ?? 0;
  }

  _onClose(options) {
    this.filterController?.abort();
    this.filterController = null;
    return super._onClose?.(options);
  }

  async collectTargets() {
    const targets = [];
    for (const journal of globalThis.game?.journal?.contents ?? []) {
      const folderName = journal.folder?.name ?? "";
      for (const page of journal.pages?.contents ?? []) {
        if (page.type !== "text") continue;
        const metadata = getPageMetadata(page);
        const validation = validatePageMetadata(page, this.runtime.adapter);
        targets.push(this.#target({
          key: `journal-page:${page.uuid}`,
          type: "journal-page",
          status: "ordinary",
          uuid: page.uuid,
          documentUuid: journal.uuid,
          blockId: null,
          folderName,
          documentName: journal.name,
          targetName: page.name,
          language: metadata.language,
          missing: !metadata.language,
          invalid: validation.messages.some((message) => message.code === "missing-language")
        }));
      }

      const extensionData = await this.runtime.executor.run(
        "bulk.getIlluminatedDocumentMetadata",
        () => Promise.resolve(this.runtime.idocIntegration.getDocumentMetadata(journal)),
        { componentId: MODULE_ID, documentUuid: journal.uuid },
        null
      );
      if (!extensionData || typeof extensionData !== "object" || !Object.keys(extensionData).length) continue;
      const metadata = normalizeIlluminatedMetadata(extensionData, {
        defaultLanguage: this.runtime.settings.get(SETTINGS.DEFAULT_LANGUAGE),
        languageNameVisibility: this.runtime.settings.get(SETTINGS.NAME_VISIBILITY)
      });
      const validation = validateIlluminatedMetadata(metadata, this.runtime.adapter);
      targets.push(this.#target({
        key: `idoc-document:${journal.uuid}`,
        type: "idoc-document",
        status: "illuminated",
        uuid: journal.uuid,
        documentUuid: journal.uuid,
        blockId: null,
        folderName,
        documentName: journal.name,
        targetName: this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.DocumentDefaults"),
        language: metadata.document.defaultLanguage,
        missing: !metadata.document.defaultLanguage,
        invalid: validation.messages.some((message) => message.path === "document.defaultLanguage")
      }));
      for (const [blockId, block] of Object.entries(metadata.blocks)) {
        targets.push(this.#target({
          key: `idoc-block:${journal.uuid}:${blockId}`,
          type: "idoc-block",
          status: "illuminated",
          uuid: journal.uuid,
          documentUuid: journal.uuid,
          blockId,
          folderName,
          documentName: journal.name,
          targetName: block.label ?? blockId,
          language: block.language ?? INHERIT_LANGUAGE,
          missing: block.language === "",
          invalid: validation.messages.some((message) => message.path === `blocks.${blockId}.language`)
        }));
      }
    }
    return targets.sort((left, right) =>
      left.folderName.localeCompare(right.folderName)
      || left.documentName.localeCompare(right.documentName)
      || left.targetName.localeCompare(right.targetName));
  }

  applyFilters() {
    const element = this.element;
    if (!element?.querySelectorAll) return;
    const value = (name) => element.querySelector(`[name='${name}']`)?.value ?? "";
    const folder = value("filterFolder");
    const type = value("filterType");
    const language = value("filterLanguage");
    const state = value("filterState");
    const integration = value("filterIntegration");
    const search = value("filterSearch").trim().toLocaleLowerCase();
    for (const row of element.querySelectorAll(".bulk-row")) {
      const visible = (!folder || row.dataset.folder === folder)
        && (!type || row.dataset.type === type)
        && (!language || row.dataset.language === language)
        && (!integration || row.dataset.integration === integration)
        && (!state
          || (state === "missing" && row.dataset.missing === "true")
          || (state === "invalid" && row.dataset.invalid === "true")
          || (state === "valid" && row.dataset.invalid !== "true" && row.dataset.missing !== "true"))
        && (!search || row.textContent.toLocaleLowerCase().includes(search));
      row.hidden = !visible;
    }
    this.updatePreviewCount();
  }

  updatePreviewCount() {
    const element = this.element;
    if (!element?.querySelectorAll) return;
    const visible = [...element.querySelectorAll(".bulk-row")].filter((row) => !row.hidden);
    const selected = visible.filter((row) => row.querySelector("input[type='checkbox']")?.checked).length;
    const counter = element.querySelector("[data-preview-count]");
    if (counter) counter.textContent = this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.PreviewCount")
      .replace("{selected}", selected)
      .replace("{visible}", visible.length);
  }

  static async refresh() {
    this.captureUiState?.();
    await this.render({ force: true });
  }

  static selectVisible() {
    for (const row of this.element?.querySelectorAll?.(".bulk-row") ?? []) {
      const checkbox = row.querySelector("input[type='checkbox']");
      if (!row.hidden && checkbox) checkbox.checked = true;
    }
    this.updatePreviewCount();
  }

  static clearSelection() {
    for (const input of this.element?.querySelectorAll?.(".bulk-row input[type='checkbox']") ?? []) input.checked = false;
    this.updatePreviewCount();
  }

  static async onSubmit(event, form, formData) {
    if (!globalThis.game?.user?.isGM) throw new Error("GM permission is required.");
    if (this.submitting) return false;
    this.submitting = true;
    this.element?.setAttribute?.("aria-busy", "true");
    this.captureUiState?.();
    try {
      const data = formData?.object ?? Object.fromEntries(new FormData(form));
      const selectedKeys = parseSelectedKeys(data);
      if (!selectedKeys.length) {
        this.result = { updated: 0, validated: 0, message: this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.NoneSelected") };
        return this.render({ force: true });
      }
      const targets = await this.collectTargets();
      const selectedTargets = targets.filter((target) => selectedKeys.includes(target.key));
      const operation = data.operation ?? "assign";
      const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
      if (operation !== "validate" && typeof DialogV2?.confirm !== "function") {
        this.result = { message: this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.ConfirmationUnavailable") };
        await this.render({ force: true });
        return false;
      }
      const confirmed = operation === "validate"
        ? true
        : await DialogV2.confirm({
          window: { title: this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.ConfirmTitle") },
          content: `<p>${this.runtime.localize("ILLUMINATED_LANGUAGES.App.Bulk.Confirm").replace("{count}", selectedTargets.length)}</p>`
        });
      if (!confirmed) return false;

      const failures = [];
      let updated = 0;
      let validated = 0;
      for (const target of selectedTargets) {
        const result = await this.runtime.executor.run(
          operation === "validate" ? "bulk.validate" : "bulk.assign",
          () => this._applyTarget(target, data, operation),
          { componentId: MODULE_ID, documentUuid: target.documentUuid, languageId: data.language },
          null
        );
        if (result === null) failures.push(target.key);
        else if (operation === "validate") validated += 1;
        else updated += 1;
      }
        this.result = { updated, validated, failed: failures.length, failures };
        if (updated) await this.runtime.rerenderOpenViews();
        if (updated && failures.length === 0) this.captureUiState?.({ includeSelection: false });
        await this.render({ force: true });
        return true;
    } finally {
      this.submitting = false;
      this.element?.removeAttribute?.("aria-busy");
    }
  }

  async _applyTarget(target, data, operation) {
    const document = await globalThis.fromUuid?.(target.uuid);
    if (!document) throw new Error(`Document not found: ${target.uuid}`);
    if (operation === "validate") {
      if (target.type === "journal-page") return validatePageMetadata(document, this.runtime.adapter);
      const metadata = this.runtime.idocIntegration.getDocumentMetadata(document);
      return validateIlluminatedMetadata(metadata, this.runtime.adapter);
    }

    const language = data.language === INHERIT_LANGUAGE && target.type !== "idoc-block"
      ? this.runtime.settings.get(SETTINGS.DEFAULT_LANGUAGE) ?? PLAIN_LANGUAGE
      : data.language;
    const requireLiteracy = toBoolean(data.requireLiteracy);
    const languageNameVisibility = data.languageNameVisibility ?? "gm-only";
    const unreadableFallback = data.unreadableFallback ?? "polyglot";

    if (target.type === "journal-page") {
      return setPageMetadata(document, {
        ...getPageMetadata(document),
        enabled: true,
        language,
        requireLiteracy,
        languageNameVisibility,
        unreadableFallback
      });
    }
    if (target.type === "idoc-document") {
      const current = normalizeIlluminatedMetadata(this.runtime.idocIntegration.getDocumentMetadata(document));
      return this.runtime.idocIntegration.setDocumentMetadata(document, {
        ...current,
        document: {
          ...current.document,
          defaultLanguage: language,
          requireLiteracy,
          languageNameVisibility,
          unreadableFallback
        }
      });
    }
    const currentBlock = this.runtime.idocIntegration.getBlockMetadata(document, target.blockId) ?? {};
    return this.runtime.idocIntegration.setBlockMetadata(document, target.blockId, { ...currentBlock, language });
  }

  #target(value) {
    const typeLabelKeys = {
      "journal-page": "ILLUMINATED_LANGUAGES.App.Bulk.JournalPage",
      "idoc-document": "ILLUMINATED_LANGUAGES.App.Bulk.IdocDocument",
      "idoc-block": "ILLUMINATED_LANGUAGES.App.Bulk.IdocBlock"
    };
    return Object.freeze({
      ...value,
      encodedKey: encodeURIComponent(value.key),
      typeLabel: this.runtime.localize(typeLabelKeys[value.type] ?? value.type),
      languageLabel: this.#languageLabel(value.language)
    });
  }

  #languageLabel(languageId) {
    if (languageId === INHERIT_LANGUAGE) return this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Inherit");
    if (languageId === PLAIN_LANGUAGE) return this.runtime.localize("ILLUMINATED_LANGUAGES.Language.Plain");
    return this.runtime.adapter.getLanguageLabel(languageId);
  }
}

function parseSelectedKeys(data) {
  const nested = data.target && typeof data.target === "object"
    ? Object.entries(data.target)
    : Object.entries(data).filter(([key]) => key.startsWith("target.")).map(([key, value]) => [key.slice(7), value]);
  return nested
    .filter(([, value]) => value === true || value === "true" || value === "on")
    .map(([key]) => decodeURIComponent(key));
}

function toBoolean(value) {
  return value === true || value === "true" || value === "on";
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/(["\\'\[\]#. :])/g, "\\$1");
}
