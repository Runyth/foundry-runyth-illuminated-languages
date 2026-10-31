// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
export class SafeExecutor {
  constructor({ moduleId, throttleMs = 10_000, logger = console, isGm = () => globalThis.game?.user?.isGM === true } = {}) {
    this.moduleId = moduleId ?? "runyth-illuminated-languages";
    this.throttleMs = throttleMs;
    this.logger = logger;
    this.isGm = isGm;
    this.lastLogged = new Map();
    this.errors = [];
  }

  async run(operation, callback, context = {}, fallback = undefined) {
    try {
      return await callback();
    } catch (error) {
      this.record(operation, error, context);
      return fallback;
    }
  }

  runSync(operation, callback, context = {}, fallback = undefined) {
    try {
      return callback();
    } catch (error) {
      this.record(operation, error, context);
      return fallback;
    }
  }

  record(operation, error, context = {}) {
    const safeContext = {
      componentId: context.componentId ?? null,
      documentUuid: context.documentUuid ?? null,
      languageId: this.isGm() ? context.languageId ?? null : null
    };
    const message = error instanceof Error ? error.message : String(error);
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      message,
      ...safeContext
    };
    this.errors.push(entry);
    if (this.errors.length > 50) this.errors.shift();
    const key = JSON.stringify([operation, message, safeContext.componentId, safeContext.documentUuid, safeContext.languageId]);
    const now = Date.now();
    if ((this.lastLogged.get(key) ?? 0) + this.throttleMs <= now) {
      this.lastLogged.set(key, now);
      this.logger.error(`${this.moduleId} | ${operation} failed`, { ...safeContext, error });
    }
  }

  clear() {
    this.errors.length = 0;
    this.lastLogged.clear();
  }

  getDiagnostics() {
    return this.errors.map((entry) => ({ ...entry }));
  }
}
