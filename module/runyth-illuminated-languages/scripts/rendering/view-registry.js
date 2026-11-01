// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export class OpenViewRegistry {
  constructor({ executor = null } = {}) {
    this.executor = executor;
    this.views = new Map();
  }

  register(app, { documentUuid = null, pageUuid = null, root = null } = {}) {
    const id = app?.appId ?? app?.id;
    if (id === undefined || id === null) return false;
    this.views.set(id, { app, documentUuid, pageUuid, root });
    return true;
  }

  unregister(app) {
    const id = app?.appId ?? app?.id;
    if (id === undefined || id === null) return false;
    return this.views.delete(id);
  }

  async rerender(documentUuid = null) {
    let rendered = 0;
    for (const [id, entry] of [...this.views.entries()]) {
      if (documentUuid && entry.documentUuid !== documentUuid && entry.pageUuid !== documentUuid) continue;
      if (!entry.app?.render || entry.app?.rendered === false) {
        this.views.delete(id);
        continue;
      }
      const operation = () => entry.app.render({ force: true });
      const result = this.executor
        ? await this.executor.run(
            "journal.rerender",
            operation,
            { componentId: "journal-view", documentUuid: entry.documentUuid ?? entry.pageUuid },
            null
          )
        : await operation();
      if (result !== null) rendered += 1;
    }
    return rendered;
  }

  invalidate(documentUuid = null) {
    for (const entry of this.views.values()) {
      if (documentUuid && entry.documentUuid !== documentUuid && entry.pageUuid !== documentUuid) continue;
      for (const element of [entry.root, entry.app?.element]) {
        if (element?.dataset) delete element.dataset.illuminatedLanguagesTransformed;
      }
    }
  }

  getDiagnostics() {
    return { openViews: this.views.size };
  }
}
