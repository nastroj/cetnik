
export type AnalysisCategory = 'letters' | 'diacritics' | 'numbers' | 'symbols' | 'all';

export interface CharacterCounts {
  [key: string]: number;
}

export interface AnalysisResults {
  letters: CharacterCounts;
  diacritics: CharacterCounts;
  numbers: CharacterCounts;
  symbols: CharacterCounts;
}

export interface Stats {
  total: number;
  letters: number;
  diacritics: number;
  numbers: number;
  symbols: number;
}
