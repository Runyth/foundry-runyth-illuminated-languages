// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
const ApplicationV2 = globalThis.foundry?.applications?.api?.ApplicationV2 ?? class {
  constructor(options = {}) {
    this.options = options;
    this.element = null;
  }

  async render() {
    return this;
  }

  async close() {}
};

const HandlebarsApplicationMixin = globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin ?? ((Base) => Base);

export const HandlebarsApplicationV2 = HandlebarsApplicationMixin(ApplicationV2);
