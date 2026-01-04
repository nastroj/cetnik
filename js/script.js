// Global State
const state = {
  lastData: { counts: {}, diacriticsCounts: {}, numbersCounts: {}, symbolsCounts: {} },
  originalData: { counts: {}, diacriticsCounts: {}, numbersCounts: {}, symbolsCounts: {} },
  currentView: 'all',
  debounceTimer: null,
  discountCharsMap: {},
  discountMode: false,
  discountDebounceTimer: null,
  isCaseSensitive: false
};

// CONSTANTS & REGEX
const REGEX_LETTER = /[a-zA-Z]/;
const REGEX_NUMBER = /[0-9]/;
const REGEX_WHITESPACE = /\s/;

// Diacritic display mapping
const DIACRITIC_DISPLAY = {
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

// Map standalone characters to combining characters for discount logic
const STANDALONE_TO_COMBINING = {
  '´': '\u0301', 'ˇ': '\u030C', 'ˆ': '\u0302', '¨': '\u0308',
  '°': '\u030A', '~': '\u0303', '`': '\u0300', '˝': '\u030B', '¸': '\u0327',
};

// Service Worker Registration
if ('serviceWorker' in navigator) {
  if (window.location.protocol === 'file:') {
    console.warn('Service Worker registration skipped: PWA features require a web server (http/https).');
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
  }
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
  
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
});

// Initialization & Drag-n-Drop
document.addEventListener('DOMContentLoaded', () => {
  const textareaWrapper = document.getElementById('textareaWrapper');
  if (textareaWrapper) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
      document.body.addEventListener(eName, e => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eName => textareaWrapper.addEventListener(eName, () => textareaWrapper.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(eName => textareaWrapper.addEventListener(eName, () => textareaWrapper.classList.remove('drag-over'), false));
    textareaWrapper.addEventListener('drop', handleDrop, false);
  }
  initTheme();
});

function handleDrop(e) {
  const files = e.dataTransfer.files;
  if (files.length > 0) handleDroppedFile(files[0]);
}

function handleDroppedFile(file) {
  if (!file.type.match('text.*') && !file.name.endsWith('.txt')) {
    alert('Prosím přetáhněte textový soubor (.txt)');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Soubor je příliš velký. Maximální velikost je 5MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('inputText').value = e.target.result;
    handleInput();
  };
  reader.readAsText(file, 'UTF-8');
}

// Logic Helper: Decompose Character
function getNormalizedChar(char) {
  // Check if standalone diacritic needs mapping
  if (STANDALONE_TO_COMBINING[char]) {
    return [{ key: STANDALONE_TO_COMBINING[char], type: 'diacritic' }];
  }

  const normalized = char.normalize('NFD');
  const results = [];

  // If no decomposition happened (length 1), it's a simple char
  if (normalized.length === 1) {
    let key = char;
    if (!state.isCaseSensitive && REGEX_LETTER.test(key)) {
      key = key.toUpperCase();
    }
    
    let type = 'symbol';
    if (REGEX_LETTER.test(char)) type = 'letter';
    else if (REGEX_NUMBER.test(char)) type = 'number';
    
    results.push({ key, type });
    return results;
  }

  // Decomposed: Base char + Diacritics
  const baseChar = normalized[0];
  const isUpper = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();
  
  // Handle Base
  let baseKey = baseChar;
  if (!state.isCaseSensitive && REGEX_LETTER.test(baseKey)) {
    baseKey = baseKey.toUpperCase();
  }
  results.push({ key: baseKey, type: REGEX_LETTER.test(baseChar) ? 'letter' : 'symbol' });

  // Handle Diacritics
  for (let i = 1; i < normalized.length; i++) {
    const mark = normalized[i];
    let markKey = mark;
    if (state.isCaseSensitive) {
      markKey = `${mark}_${isUpper ? 'CAP' : 'SMALL'}`;
    }
    results.push({ key: markKey, type: 'diacritic' });
  }

  return results;
}

function getDiacriticDisplay(charKey) {
  if (charKey.includes('_')) {
    const [char, type] = charKey.split('_');
    const displayChar = DIACRITIC_DISPLAY[char] || char;
    return `${displayChar}<span class="diacritic-variant">${type === 'CAP' ? '(velké)' : '(malé)'}</span>`;
  }
  return DIACRITIC_DISPLAY[charKey] || charKey;
}

// Feature Toggles
function toggleCaseSensitive() {
  state.isCaseSensitive = !state.isCaseSensitive;
  document.getElementById('caseSensitiveText')?.classList.toggle('active', state.isCaseSensitive);
  
  if (document.getElementById('inputText').value.trim()) handleInput();
  if (document.getElementById('discountText')?.value.trim()) handleDiscountInput();
}

function toggleDiscount() {
  const section = document.getElementById('discountSection');
  const toggle = document.getElementById('discountToggle');
  
  state.discountMode = !state.discountMode;
  section.style.display = state.discountMode ? 'block' : 'none';
  toggle.classList.toggle('active', state.discountMode);

  if (state.discountMode) setTimeout(() => document.getElementById('discountText').focus(), 100);
  if (document.getElementById('inputText').value.trim()) handleInput();
}

// Discount Logic
function handleDiscountInput() {
  const discountText = document.getElementById('discountText').value.replace(/\s/g, '');
  document.getElementById('clearDiscountBtn').disabled = discountText.length === 0;

  state.discountCharsMap = {};
  
  for (const char of discountText) {
    const items = getNormalizedChar(char);
    for (const item of items) {
      state.discountCharsMap[item.key] = (state.discountCharsMap[item.key] || 0) + 1;
    }
  }

  const total = Object.values(state.discountCharsMap).reduce((a, b) => a + b, 0);
  document.getElementById('discountCounter').textContent = 
    `${total} ${total === 1 ? 'znak' : total < 5 ? 'znaky' : 'znaků'}`;

  clearTimeout(state.discountDebounceTimer);
  state.discountDebounceTimer = setTimeout(() => {
    if (document.getElementById('inputText').value.trim()) applyDiscount();
  }, 300);
}

function clearDiscount() {
  document.getElementById('discountText').value = '';
  document.getElementById('discountCounter').textContent = '0 znaků';
  document.getElementById('clearDiscountBtn').disabled = true;
  state.discountCharsMap = {};
  
  if (document.getElementById('inputText').value.trim()) {
    state.lastData = JSON.parse(JSON.stringify(state.originalData));
    renderResults(state.lastData);
    updateStats(state.lastData);
  }
}

function applyDiscount() {
  state.lastData = JSON.parse(JSON.stringify(state.originalData));

  for (const [char, count] of Object.entries(state.discountCharsMap)) {
    let toRemove = count;
    let found = false;

    // Helper to try removing from a specific category
    const tryRemove = (dataObj, key) => {
      if (dataObj[key] !== undefined) {
        dataObj[key] -= toRemove;
        found = true;
        return true;
      }
      return false;
    };

    // Try direct match first
    if (tryRemove(state.lastData.counts, char)) {}
    else if (tryRemove(state.lastData.diacriticsCounts, char)) {}
    else if (tryRemove(state.lastData.numbersCounts, char)) {}
    else if (tryRemove(state.lastData.symbolsCounts, char)) {}
    else if (state.isCaseSensitive && char in DIACRITIC_DISPLAY) {
      // Fallback logic for case-sensitive generic diacritics
      const smallKey = `${char}_SMALL`;
      const capKey = `${char}_CAP`;
      
      if (state.lastData.diacriticsCounts[smallKey] !== undefined) {
        state.lastData.diacriticsCounts[smallKey] -= toRemove;
        found = true;
      } else if (state.lastData.diacriticsCounts[capKey] !== undefined) {
        state.lastData.diacriticsCounts[capKey] -= toRemove;
        found = true;
      }
    }

    // If never found, mark as negative in appropriate category
    if (!found) {
      if (char.includes('_') || char in DIACRITIC_DISPLAY) state.lastData.diacriticsCounts[char] = -toRemove;
      else if (REGEX_NUMBER.test(char)) state.lastData.numbersCounts[char] = -toRemove;
      else if (REGEX_LETTER.test(char)) state.lastData.counts[char] = -toRemove;
      else state.lastData.symbolsCounts[char] = -toRemove;
    }
  }

  cleanData(state.lastData);
  renderResults(state.lastData);
  updateStats(state.lastData);
}

function cleanData(data) {
  const clean = obj => {
    Object.keys(obj).forEach(key => { if (obj[key] === 0) delete obj[key]; });
    return obj;
  };
  ['counts', 'diacriticsCounts', 'numbersCounts', 'symbolsCounts'].forEach(k => clean(data[k]));
}

// Analysis
function analyzeText(text) {
  const result = { counts: {}, diacriticsCounts: {}, numbersCounts: {}, symbolsCounts: {} };
  
  for (const char of text) {
    if (REGEX_WHITESPACE.test(char)) continue;

    const items = getNormalizedChar(char);
    for (const item of items) {
      const target = item.type === 'letter' ? result.counts :
                     item.type === 'number' ? result.numbersCounts :
                     item.type === 'diacritic' ? result.diacriticsCounts :
                     result.symbolsCounts;
      target[item.key] = (target[item.key] || 0) + 1;
    }
  }
  return result;
}

// UI & View
function setView(view) {
  if (state.currentView === view) return;
  state.currentView = view;
  
  document.querySelectorAll('.view-btn').forEach(btn => {
    const isActive = btn.id === `view${view.charAt(0).toUpperCase() + view.slice(1)}`;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  
  renderResults(state.lastData);
}

function renderResults(data) {
  const resultsDiv = document.getElementById("results");
  let displayData = {};
  let sortedKeys = [];

  const { counts, diacriticsCounts, numbersCounts, symbolsCounts } = data;

  if (state.currentView === 'all') {
     sortedKeys = [
       ...Object.keys(counts).sort(),
       ...Object.keys(diacriticsCounts).sort(),
       ...Object.keys(symbolsCounts).sort(),
       ...Object.keys(numbersCounts).sort()
     ];
     displayData = { ...counts, ...diacriticsCounts, ...symbolsCounts, ...numbersCounts };
  } else {
    // Map view name to data property
    const map = { letters: counts, numbers: numbersCounts, symbols: symbolsCounts, diacritics: diacriticsCounts };
    displayData = map[state.currentView] || counts;
    sortedKeys = Object.keys(displayData).sort();
  }

  // Check empty state
  if (sortedKeys.length === 0) {
    const isDiscounted = Object.keys(state.discountCharsMap).length > 0 && document.getElementById('inputText').value.trim();
    const message = isDiscounted ? 'Všechny znaky byly odečteny' : 'Žádné výsledky k zobrazení';
    const icon = isDiscounted ? '📊' : '📝'; // Use chart icon if discounted, memo if empty
    
    // If truly empty (not just discounted away), use start message
    const emptyHtml = !document.getElementById('inputText').value.trim() ? 
       `<div class="empty-state"><span class="empty-state-icon">📝</span><p>Začněte psaním textu výše</p></div>` :
       `<div class="empty-state"><span class="empty-state-icon">${icon}</span><p>${message}</p></div>`;

    resultsDiv.innerHTML = emptyHtml;
    // Add discount info if needed
    if (isDiscounted) appendDiscountInfo(resultsDiv);
    return;
  }

  resultsDiv.innerHTML = '';
  if (Object.keys(state.discountCharsMap).length > 0) appendDiscountInfo(resultsDiv);

  const grid = document.createElement('div');
  grid.className = 'results-grid';

  // Use DocumentFragment for batch appending
  const fragment = document.createDocumentFragment();

  sortedKeys.forEach(char => {
    const value = displayData[char];
    const isDiacritic = char in (state.lastData.diacriticsCounts) || char in (state.originalData.diacriticsCounts);
    
    const displayCharHTML = isDiacritic ? getDiacriticDisplay(char) : char;
    const displayCharText = displayCharHTML.replace(/<[^>]*>/g, '');
    
    const discountCount = state.discountCharsMap[char] || 0;
    
    // Determine original value for aria/diff
    let originMap = state.originalData.counts;
    if (state.currentView === 'numbers') originMap = state.originalData.numbersCounts;
    else if (state.currentView === 'symbols') originMap = state.originalData.symbolsCounts;
    else if (state.currentView === 'diacritics') originMap = state.originalData.diacriticsCounts;
    else if (char in state.originalData.diacriticsCounts) originMap = state.originalData.diacriticsCounts;
    else if (char in state.originalData.numbersCounts) originMap = state.originalData.numbersCounts;
    else if (char in state.originalData.symbolsCounts) originMap = state.originalData.symbolsCounts;
    
    const originalValue = originMap[char] || value;

    const box = document.createElement('div');
    box.className = 'letter-box';
    if (value < 0) box.classList.add('negative');
    else if (discountCount > 0) box.classList.add('discount-highlight');
    
    box.setAttribute('role', 'article');
    
    let ariaLabel = `${isDiacritic ? 'Diakritika' : 'Znak'} ${displayCharText}, ${value}`;
    if (discountCount > 0) ariaLabel += `, odečteno ${discountCount}`;
    box.setAttribute('aria-label', ariaLabel);

    let html = `
      <span class="letter" aria-hidden="true">${displayCharHTML}</span>
      <div class="count-container">
        <span class="count-badge" aria-hidden="true">${value}</span>
        ${(originalValue !== value && originalValue > 0) ? `<span class="original-count" aria-hidden="true">původně ${originalValue}</span>` : ''}
      </div>
    `;
    
    if (discountCount > 0) {
      html += `<div class="discounted-badge" aria-hidden="true"><span class="minus-sign">−</span><span>${discountCount}</span></div>`;
    }

    box.innerHTML = html;
    fragment.appendChild(box);
  });

  grid.appendChild(fragment);
  resultsDiv.appendChild(grid);
}

function appendDiscountInfo(parent) {
  const info = document.createElement('div');
  info.className = 'discount-info';
  const total = Object.values(state.discountCharsMap).reduce((a, b) => a + b, 0);
  const details = Object.entries(state.discountCharsMap)
    .map(([c, count]) => `${count}× ${getDiacriticDisplay(c)}`).join(', ');
    
  info.innerHTML = `<span>Odečtené znaky:</span><span class="discount-count">${total}</span><span class="discount-chars">${details}</span>`;
  parent.appendChild(info);
}

function updateStats(data) {
  const statsBar = document.getElementById('statsBar');
  const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
  
  const totalLetters = sum(data.counts);
  const totalNumbers = sum(data.numbersCounts);
  const totalSymbols = sum(data.symbolsCounts);
  const totalDiacritics = sum(data.diacriticsCounts);
  const totalChars = totalLetters + totalNumbers + totalSymbols + totalDiacritics;

  if (totalChars !== 0 || document.getElementById('inputText').value.trim()) {
    statsBar.style.display = 'grid';
    document.getElementById('totalChars').textContent = totalChars;
    document.getElementById('totalLetters').textContent = totalLetters;
    document.getElementById('totalNumbers').textContent = totalNumbers;
    document.getElementById('totalSymbols').textContent = totalSymbols;
    document.getElementById('totalDiacritics').textContent = totalDiacritics;
  } else {
    statsBar.style.display = 'none';
  }
}

function handleInput() {
  const text = document.getElementById("inputText").value;
  const len = text.replace(REGEX_WHITESPACE, '').length;
  document.getElementById('charCounter').textContent = `${len} ${len === 1 ? 'znak' : len < 5 ? 'znaky' : 'znaků'}`;
  document.getElementById('clearBtn').disabled = text.length === 0;

  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    if (!text.trim()) {
      state.lastData = { counts: {}, diacriticsCounts: {}, numbersCounts: {}, symbolsCounts: {} };
      state.originalData = JSON.parse(JSON.stringify(state.lastData));
      renderResults(state.lastData);
      updateStats(state.lastData);
      return;
    }

    state.originalData = analyzeText(text);
    
    if (Object.keys(state.discountCharsMap).length > 0) {
      applyDiscount();
    } else {
      state.lastData = JSON.parse(JSON.stringify(state.originalData));
      renderResults(state.lastData);
      updateStats(state.lastData);
    }
  }, 300);
}

function clearText() {
  document.getElementById('inputText').value = '';
  document.getElementById('charCounter').textContent = '0 znaků';
  document.getElementById('clearBtn').disabled = true;
  document.getElementById('fileInput').value = '';
  
  if (state.discountMode) clearDiscount();

  state.lastData = { counts: {}, diacriticsCounts: {}, numbersCounts: {}, symbolsCounts: {} };
  state.originalData = JSON.parse(JSON.stringify(state.lastData));
  
  renderResults(state.lastData);
  updateStats(state.lastData);
  document.getElementById('inputText').focus();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.match('text.*') && !file.name.endsWith('.txt')) {
    alert('Prosím vyberte textový soubor (.txt)');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('inputText').value = e.target.result;
    handleInput();
  };
  reader.readAsText(file);
}
