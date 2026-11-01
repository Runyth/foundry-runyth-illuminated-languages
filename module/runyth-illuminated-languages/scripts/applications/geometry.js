// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
const DEFAULT_VISIBLE_MARGIN = 64;

/**
 * Return a module-owned, serializable ApplicationV2 geometry snapshot.
 *
 * @param {object} position Application position data.
 * @returns {object}
 */
export function pickGeometry(position = {}) {
  const output = {};
  for (const key of ["left", "top", "width", "height"]) {
    if (Number.isFinite(position?.[key])) output[key] = position[key];
  }
  return output;
}

/**
 * Sanitize persisted window geometry so a monitor or viewport change cannot
 * reopen a module window completely off-screen.
 *
 * @param {object} geometry Persisted client setting.
 * @param {object} options Geometry constraints.
 * @returns {object}
 */
export function restoreGeometry(
  geometry = {},
  {
    viewportWidth = globalThis.innerWidth,
    viewportHeight = globalThis.innerHeight,
    minimumWidth = 320,
    minimumHeight = 180,
    visibleMargin = DEFAULT_VISIBLE_MARGIN
  } = {}
) {
  const restored = pickGeometry(geometry);
  const hasViewport = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)
    && viewportWidth > 0 && viewportHeight > 0;

  if (Number.isFinite(restored.width)) {
    restored.width = Math.max(minimumWidth, hasViewport ? Math.min(restored.width, viewportWidth) : restored.width);
  }
  if (Number.isFinite(restored.height)) {
    restored.height = Math.max(minimumHeight, hasViewport ? Math.min(restored.height, viewportHeight) : restored.height);
  }

  if (!hasViewport) return restored;
  const width = Number.isFinite(restored.width) ? restored.width : minimumWidth;
  const height = Number.isFinite(restored.height) ? restored.height : minimumHeight;
  if (Number.isFinite(restored.left)) {
    restored.left = width >= viewportWidth
      ? 0
      : clamp(restored.left, visibleMargin - width, viewportWidth - visibleMargin);
  }
  if (Number.isFinite(restored.top)) {
    restored.top = height >= viewportHeight
      ? 0
      : clamp(restored.top, 0, viewportHeight - Math.min(visibleMargin, height));
  }
  return restored;
}

/**
 * Build a stable ApplicationV2 ID from a Foundry UUID without retaining the
 * document itself.
 *
 * @param {string} prefix Application prefix.
 * @param {string} uuid Foundry document UUID.
 * @returns {string}
 */
export function documentApplicationId(prefix, uuid) {
  const suffix = String(uuid ?? "unknown")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-96) || "unknown";
  return `${prefix}-${suffix}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
