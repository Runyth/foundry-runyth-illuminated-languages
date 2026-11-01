// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { METADATA_SCHEMA_VERSION, MODULE_ID, SETTINGS } from "../constants.js";
import { getPageMetadata, setPageMetadata } from "../journals/metadata.js";

export class MigrationManager {
  constructor({ gameRef = () => globalThis.game, settings, executor, idocIntegration } = {}) {
    this.gameRef = gameRef;
    this.settings = settings;
    this.executor = executor;
    this.idocIntegration = idocIntegration;
  }

  async migrateAll({ force = false } = {}) {
    if (!this.gameRef()?.user?.isGM) return { skipped: true, reason: "gm-only" };
    const current = Number(this.settings.get(SETTINGS.MIGRATION_VERSION) ?? 0);
    if (!force && current >= METADATA_SCHEMA_VERSION) return { skipped: true, current };
    const journal = await this.migrateJournalPages();
    const illuminatedDocuments = await this.idocIntegration?.migrateAll?.() ?? { skipped: true };
    if (journal.failed === 0 && illuminatedDocuments.failed !== true) {
      await this.settings.set(SETTINGS.MIGRATION_VERSION, METADATA_SCHEMA_VERSION);
    }
    return { journal, illuminatedDocuments };
  }

  async migrateJournalPages() {
    const pages = (this.gameRef()?.journal?.contents ?? []).flatMap((entry) => entry.pages?.contents ?? []);
    let migrated = 0;
    let failed = 0;
    for (const page of pages) {
      const raw = page.getFlag?.(MODULE_ID, "metadata") ?? page.flags?.[MODULE_ID]?.metadata;
      if (!raw || raw.schemaVersion === METADATA_SCHEMA_VERSION) continue;
      const result = await this.executor.run(
        "migration.journalPage",
        async () => setPageMetadata(page, getPageMetadata(page)),
        { componentId: "journal-migration", documentUuid: page.uuid },
        null
      );
      if (result) migrated += 1;
      else failed += 1;
    }
    return { examined: pages.length, migrated, failed };
  }
}
