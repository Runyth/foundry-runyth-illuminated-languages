// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
const UNSUPPORTED = Symbol("runyth-illuminated-languages-unsupported");

export function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

/**
 * Create and recursively freeze a module-owned snapshot.
 *
 * Only arrays and plain objects are traversed. Accessor properties are never
 * invoked, unsupported complex instances are replaced with null, and cycles
 * are preserved safely in the copied graph. The caller's objects are never
 * frozen or mutated.
 */
export function deepFreeze(value) {
  const copied = copyOwnedData(value, new WeakMap());
  const normalized = copied === UNSUPPORTED ? null : copied;
  return freezeOwnedData(normalized, new WeakSet());
}

function copyOwnedData(value, seen) {
  if (value === null || value === undefined) return value;
  if (["string", "number", "boolean", "bigint", "symbol", "function"].includes(typeof value)) return value;
  if (typeof value !== "object") return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return UNSUPPORTED;
  if (seen.has(value)) return seen.get(value);

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
  seen.set(value, copy);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable) continue;
    if (!("value" in descriptor)) {
      copy[key] = null;
      continue;
    }
    const child = copyOwnedData(descriptor.value, seen);
    copy[key] = child === UNSUPPORTED ? null : child;
  }
  return copy;
}

function freezeOwnedData(value, seen) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeOwnedData(value[key], seen);
  return Object.freeze(value);
}

export function asSet(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value.filter((entry) => typeof entry === "string"));
  if (value && typeof value === "object") {
    return new Set(Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key));
  }
  return new Set();
}

export function sanitizeIdentifier(value) {
  const result = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(result)) throw new Error("Invalid identifier.");
  return result;
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
