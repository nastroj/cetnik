
import { AnalysisResults, CharacterCounts } from '../types';
import { STANDALONE_TO_COMBINING } from '../constants';

const isLetter = (char: string) => /[a-zA-Z]/.test(char);
const isNumber = (char: string) => /[0-9]/.test(char);
const isWhitespace = (char: string) => /\s/.test(char);

export function analyzeText(text: string, isCaseSensitive: boolean): AnalysisResults {
  const letters: CharacterCounts = {};
  const diacritics: CharacterCounts = {};
  const numbers: CharacterCounts = {};
  const symbols: CharacterCounts = {};

  for (const char of text) {
    if (isWhitespace(char)) continue;

    const normalized = char.normalize("NFD");

    if (normalized.length > 1) {
      // Character has diacritics (e.g., 'á' -> 'a' + '\u0301')
      const baseChar = normalized[0];
      const isUpper = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();

      let keyChar = isCaseSensitive ? baseChar : baseChar.toUpperCase();
      if (isLetter(keyChar)) {
        letters[keyChar] = (letters[keyChar] || 0) + 1;
      }

      for (let j = 1; j < normalized.length; j++) {
        const diacritic = normalized[j];
        const dKey = isCaseSensitive ? `${diacritic}_${isUpper ? 'CAP' : 'SMALL'}` : diacritic;
        diacritics[dKey] = (diacritics[dKey] || 0) + 1;
      }
    } else if (isNumber(char)) {
      numbers[char] = (numbers[char] || 0) + 1;
    } else if (isLetter(char)) {
      const key = isCaseSensitive ? char : char.toUpperCase();
      letters[key] = (letters[key] || 0) + 1;
    } else {
      symbols[char] = (symbols[char] || 0) + 1;
    }
  }

  return { letters, diacritics, numbers, symbols };
}

export function parseDiscount(text: string, isCaseSensitive: boolean): CharacterCounts {
  const discountMap: CharacterCounts = {};
  const cleanText = text.replace(/\s/g, '');

  for (const char of cleanText) {
    if (STANDALONE_TO_COMBINING[char]) {
      const combining = STANDALONE_TO_COMBINING[char];
      discountMap[combining] = (discountMap[combining] || 0) + 1;
      continue;
    }

    const normalized = char.normalize('NFD');
    if (normalized.length > 1) {
      const baseChar = normalized[0];
      const diacritics = normalized.slice(1);
      const isUpper = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();

      const baseKey = isCaseSensitive ? baseChar : baseChar.toUpperCase();
      discountMap[baseKey] = (discountMap[baseKey] || 0) + 1;

      for (const d of diacritics) {
        const dKey = isCaseSensitive ? `${d}_${isUpper ? 'CAP' : 'SMALL'}` : d;
        discountMap[dKey] = (discountMap[dKey] || 0) + 1;
      }
    } else {
      const key = isLetter(char) && !isCaseSensitive ? char.toUpperCase() : char;
      discountMap[key] = (discountMap[key] || 0) + 1;
    }
  }

  return discountMap;
}
