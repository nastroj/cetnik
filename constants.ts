
export const DIACRITIC_DISPLAY: Record<string, string> = {
  '\u0301': '´',  // Acute accent (čárka)
  '\u030C': 'ˇ',  // Caron (háček)
  '\u0302': 'ˆ',  // Circumflex
  '\u0308': '¨',  // Diaeresis
  '\u030A': '°',  // Ring above
  '\u0303': '~',  // Tilde
  '\u0300': '`',  // Grave accent
  '\u030B': '˝',  // Double acute
  '\u0327': '¸',  // Cedilla
};

export const STANDALONE_TO_COMBINING: Record<string, string> = {
  '´': '\u0301',
  'ˇ': '\u030C',
  'ˆ': '\u0302',
  '¨': '\u0308',
  '°': '\u030A',
  '~': '\u0303',
  '`': '\u0300',
  '˝': '\u030B',
  '¸': '\u0327',
};
