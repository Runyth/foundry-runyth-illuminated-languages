// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { IlluminatedLanguagesRuntime } from "./runtime.js";

const runtime = new IlluminatedLanguagesRuntime();

globalThis.Hooks.once("init", () => runtime.init());
globalThis.Hooks.once("ready", () => void runtime.ready());
