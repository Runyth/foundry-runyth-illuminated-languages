// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
function parse(version) {
  const match = String(version ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compare(a, b) {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return Number.NaN;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = comparator.trim().match(/^(>=|<=|>|<|=|\^|~)?\s*(\d+\.\d+\.\d+)$/);
  if (!match) return false;
  const [, operator = "=", target] = match;
  const result = compare(version, target);
  if (Number.isNaN(result)) return false;
  if (operator === ">=") return result >= 0;
  if (operator === "<=") return result <= 0;
  if (operator === ">") return result > 0;
  if (operator === "<") return result < 0;
  if (operator === "^") {
    const [major] = parse(target);
    return result >= 0 && compare(version, `${major + 1}.0.0`) < 0;
  }
  if (operator === "~") {
    const [major, minor] = parse(target);
    return result >= 0 && compare(version, `${major}.${minor + 1}.0`) < 0;
  }
  return result === 0;
}

export function satisfies(version, range) {
  if (!parse(version)) return false;
  const alternatives = String(range).split("||").map((entry) => entry.trim()).filter(Boolean);
  return alternatives.some((alternative) => {
    const comparators = alternative.split(/\s+/).filter(Boolean);
    return comparators.every((comparator) => satisfiesComparator(version, comparator));
  });
}

export function assertSatisfies(version, range, label = "Version") {
  if (!satisfies(version, range)) {
    throw new Error(`${label} ${version ?? "unknown"} does not satisfy ${range}.`);
  }
  return true;
}

export { compare, parse };
