// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableSeed(parts) {
  return hashString(parts.map((part) => String(part ?? "")).join("\u241f"));
}

export function neutralScramble(text, seedValue) {
  const glyphs = "ᚠᚢᚦᚨᚱᚲᚷᚹᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛞᛟ";
  let state = (seedValue >>> 0) || 0x9e3779b9;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  return String(text).replace(/\S/gu, (character) => {
    if (/^[\p{P}\p{S}]$/u.test(character)) return character;
    return glyphs[Math.floor(random() * glyphs.length)];
  });
}
