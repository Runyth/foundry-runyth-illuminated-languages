// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "../constants.js";

export class SettingsFacade {
  constructor({ gameRef = () => globalThis.game } = {}) {
    this.gameRef = gameRef;
    this.fallback = new Map();
  }

  get(key) {
    try {
      return this.gameRef()?.settings?.get?.(MODULE_ID, key) ?? this.fallback.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key, value) {
    try {
      if (this.gameRef()?.settings?.set) return await this.gameRef().settings.set(MODULE_ID, key, value);
    } catch {
      // Test and early-init fallback.
    }
    this.fallback.set(key, value);
    return value;
  }
}
