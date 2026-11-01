// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export default [
  {
    files: ["**/*.js", "**/*.mjs"],
    ignores: ["dist/**"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module"
    },
    rules: {
      indent: ["error", 2],
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],
      "no-eval": "error",
      "no-new-func": "error"
    }
  }
];
