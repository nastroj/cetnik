import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './components/Card';
import { analyzeText, parseDiscount, sortCharacters } from './utils/analysis';
import { AnalysisResults, AnalysisCategory, CharacterCounts, Stats, SortMode } from './types';
import { DIACRITIC_DISPLAY } from './constants';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [category, setCategory] = useState<AnalysisCategory>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');

  // Sync theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-slate-900', 'text-slate-100');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
      document.body.classList.remove('bg-slate-900', 'text-slate-100');
    }
  }, [theme]);

  const originalResults = useMemo(() => analyzeText(inputText, isCaseSensitive), [inputText, isCaseSensitive]);
  const discountMap = useMemo(() => parseDiscount(discountText, isCaseSensitive), [discountText, isCaseSensitive]);

  const finalResults = useMemo(() => {
    const results = JSON.parse(JSON.stringify(originalResults)) as AnalysisResults;
    (Object.entries(discountMap) as [string, number][]).forEach(([char, count]) => {
      let found = false;
      const categories: (keyof AnalysisResults)[] = ['letters', 'diacritics', 'numbers', 'symbols'];
      for (const cat of categories) {
        if (results[cat][char] !== undefined) {
          results[cat][char] = (results[cat][char] || 0) - count;
          found = true;
          break;
        }
      }
      if (!found && count > 0) {
        if (char.includes('_') || DIACRITIC_DISPLAY[char]) {
          results.diacritics[char] = -count;
        } else if (/[a-zA-Z]/.test(char)) {
          results.letters[char] = -count;
        } else if (/[0-9]/.test(char)) {
          results.numbers[char] = -count;
        } else {
          results.symbols[char] = -count;
        }
      }
    });
    return results;
  }, [originalResults, discountMap]);

  const stats = useMemo<Stats>(() => {
    const calcTotal = (obj: CharacterCounts) => Object.values(obj).reduce((a, b) => a + b, 0);
    return {
      letters: calcTotal(finalResults.letters),
      diacritics: calcTotal(finalResults.diacritics),
      numbers: calcTotal(finalResults.numbers),
      symbols: calcTotal(finalResults.symbols),
      total: calcTotal(finalResults.letters) + calcTotal(finalResults.diacritics) + calcTotal(finalResults.numbers) + calcTotal(finalResults.symbols)
    };
  }, [finalResults]);

  const filteredResults = useMemo(() => {
    if (category === 'all') {
      return { ...finalResults.letters, ...finalResults.diacritics, ...finalResults.numbers, ...finalResults.symbols };
    }
    return finalResults[category] || {};
  }, [finalResults, category]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setInputText(event.target?.result as string);
    reader.readAsText(file);
  };

  const getCharDisplay = (key: string) => {
    if (key.includes('_')) {
      const [char, type] = key.split('_');
      const d = DIACRITIC_DISPLAY[char] || char;
      return { char: d, label: type === 'CAP' ? 'velké' : 'malé' };
    }
    return { char: DIACRITIC_DISPLAY[key] || key, label: null };
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">🚨</span>
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">Četník</h1>
          </div>
          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110 hover:shadow-md focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            aria-label={theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <Card className="dark:bg-slate-900 dark:border-slate-700/50">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label htmlFor="main-input" className="text-lg font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Text k analýze</label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg font-semibold" aria-live="polite">
                  {inputText.replace(/\s/g, '').length} znaků
                </span>            
                <button
                  onClick={() => setInputText('')}
                  disabled={!inputText}
                  className="px-4 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/20 text-rose-700 dark:text-rose-300 hover:from-rose-200 hover:to-rose-100 dark:hover:from-rose-900/60 dark:hover:to-rose-900/40 disabled:opacity-50 focus:ring-2 focus:ring-rose-400 outline-none transition-all"
                  aria-label="Vymazat obsah pole"
                >
                  Vymazat
                </button>
              </div>
            </div>

            <textarea
              id="main-input"
              className="w-full h-40 p-4 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700/50 rounded-xl focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 outline-none transition-all resize-none text-lg dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Vložte text k analýze..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                  type="button"
                  role="switch"
                  aria-checked={isCaseSensitive}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:ring-2 focus:ring-purple-400 outline-none ${
                    isCaseSensitive ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  aria-label="Rozlišovat velikost písmen"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isCaseSensitive ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rozlišovat velikost (a/A)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setIsDiscountOpen(!isDiscountOpen)}
                className={`flex-1 min-w-[150px] py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-rose-400 outline-none ${isDiscountOpen ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-700 dark:hover:to-slate-600'}`}
                aria-expanded={isDiscountOpen}
              >
                {isDiscountOpen ? '➖ Skrýt odečet' : '➖ Odečíst znaky'}
              </button>

              <label className="flex-1 min-w-[150px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-center focus-within:ring-2 focus-within:ring-purple-400 outline-none shadow-lg shadow-indigo-600/30 hover:shadow-lg hover:shadow-indigo-600/40">
                📁 Nahrát
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt" aria-label="Nahrát textový soubor" />
              </label>
            </div>
          </div>
        </Card>

        {isDiscountOpen && (
          <Card id="discount-section" className="border-rose-300 dark:border-rose-900/40 bg-gradient-to-br from-rose-50 to-rose-50/50 dark:from-rose-950/30 dark:to-rose-900/10 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label htmlFor="discount-input" className="text-sm font-bold text-rose-700 dark:text-rose-300 uppercase tracking-widest">Znaky k odečtení</label>
                <button
                  onClick={() => setDiscountText('')}
                  disabled={!discountText}
                  className="px-4 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-rose-200 to-rose-100 dark:from-rose-900/50 dark:to-rose-900/30 text-rose-700 dark:text-rose-300 hover:from-rose-300 hover:to-rose-200 dark:hover:from-rose-900/70 dark:hover:to-rose-900/50 disabled:opacity-50 focus:ring-2 focus:ring-rose-400 outline-none transition-all"
                  aria-label="Vymazat obsah pole"
                >
                  Vymazat
                </button>
              </div>
              <textarea
                id="discount-input"
                className="w-full h-24 p-4 bg-white dark:bg-slate-950 border-2 border-rose-200 dark:border-rose-900/40 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 outline-none transition-all resize-none dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Např. 'aaabb' odečte 3x 'a' a 2x 'b'..."
                value={discountText}
                onChange={(e) => setDiscountText(e.target.value)}
              />
              <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">💡 Tip: Vložením 'á' se automaticky odečte i diakritická značka '´'.</p>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" aria-label="Celkové statistiky">
          {[
            { label: 'Celkem', value: stats.total, color: 'from-slate-500 to-slate-600', lightBg: 'bg-gradient-to-br from-slate-50 to-slate-100', darkBg: 'dark:from-slate-900 dark:to-slate-800', border: 'border-slate-300 dark:border-slate-700' },
            { label: 'Písmena', value: stats.letters, color: 'from-blue-500 to-cyan-500', lightBg: 'bg-gradient-to-br from-blue-50 to-cyan-50', darkBg: 'dark:from-blue-950/40 dark:to-cyan-950/30', border: 'border-blue-300 dark:border-cyan-900/50' },
            { label: 'Diakritika', value: stats.diacritics, color: 'from-purple-500 to-pink-500', lightBg: 'bg-gradient-to-br from-purple-50 to-pink-50', darkBg: 'dark:from-purple-950/40 dark:to-pink-950/30', border: 'border-purple-300 dark:border-pink-900/50' },
            { label: 'Symboly', value: stats.symbols, color: 'from-amber-500 to-orange-500', lightBg: 'bg-gradient-to-br from-amber-50 to-orange-50', darkBg: 'dark:from-amber-950/40 dark:to-orange-950/30', border: 'border-amber-300 dark:border-orange-900/50' },
            { label: 'Čísla', value: stats.numbers, color: 'from-emerald-500 to-teal-500', lightBg: 'bg-gradient-to-br from-emerald-50 to-teal-50', darkBg: 'dark:from-emerald-950/40 dark:to-teal-950/30', border: 'border-emerald-300 dark:border-teal-900/50' }
          ].map((stat) => (
            <div key={stat.label} className={`${stat.lightBg} ${stat.darkBg} p-4 rounded-2xl border-2 ${stat.border} shadow-md hover:shadow-lg transition-shadow flex flex-col items-center justify-center text-center`}>
              <span className={`text-xs font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent uppercase tracking-widest mb-2`}>{stat.label}</span>
              <span className="text-3xl font-black bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-50 dark:to-slate-100 bg-clip-text text-transparent" aria-live="polite">{stat.value}</span>
            </div>
          ))}
        </div>

        <Card title="📊 Detailní výsledky" className="dark:bg-slate-900 dark:border-slate-700/50">

          <div className="flex flex-wrap gap-2 p-1.5 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/30 rounded-xl" role="tablist" aria-label="Filtr kategorií">
            {(['all', 'letters', 'diacritics', 'symbols', 'numbers'] as AnalysisCategory[]).map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={category === cat}
                onClick={() => setCategory(cat)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all focus:ring-2 focus:ring-purple-400 outline-none ${
                  category === cat
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {cat === 'all' ? 'Vše' : cat === 'letters' ? 'Písmena' : cat === 'diacritics' ? 'Diakritika' : cat === 'symbols' ? 'Symboly' : 'Čísla'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 p-1.5 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/30 rounded-xl mb-6" role="tablist" aria-label="Řazení výsledků">
            {(['alphabetical', 'frequency'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={sortMode === mode}
                onClick={() => setSortMode(mode)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all focus:ring-2 focus:ring-purple-400 outline-none ${
                  sortMode === mode
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {mode === 'alphabetical' ? '🔤 A-Z' : '📊 Výskyt'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" aria-live="polite">
            {sortCharacters(Object.entries(filteredResults) as [string, number][], sortMode, isCaseSensitive).map(([char, count]) => {
              const display = getCharDisplay(char);
              const originalCount = (originalResults[category === 'all' ? 'letters' : category] as CharacterCounts)?.[char] || 0;
              const isDiscounted = (discountMap[char] || 0) > 0;

              return (
                <div
                  key={char}
                  className={`relative group p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${count < 0 ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-900' :
                      isDiscounted ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900' :
                        'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  aria-label={`${display.char}${display.label ? ` (${display.label})` : ''}: počet ${count}${isDiscounted ? `, odečteno ${discountMap[char]}` : ''}`}
                >
                  {isDiscounted && (
                    <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg" aria-hidden="true">
                      -{discountMap[char]}
                    </div>
                  )}
                  <span className={`text-4xl font-black mb-2 ${count < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`} aria-hidden="true">{display.char}</span>
                  {display.label && <span className="text-[10px] uppercase font-bold text-slate-400 mb-2" aria-hidden="true">{display.label}</span>}
                  <div className="flex flex-col items-center" aria-hidden="true">
                    <span className={`text-xl font-bold ${count < 0 ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}`}>{count}</span>
                    {count !== originalCount && originalCount > 0 && <span className="text-[10px] text-slate-400 italic">Původně: {originalCount}</span>}
                  </div>
                </div>
              );
            })}
            {Object.keys(filteredResults).length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <span className="text-4xl block mb-4" aria-hidden="true">🔍</span>
                <p className="font-medium italic text-slate-500">Zatím zde nic není. Vložte text výše a pusťte se do analýzy!</p>
              </div>
            )}
          </div>
        </Card>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 dark:border-slate-800 text-center text-slate-400 text-sm">
        <p className="font-medium">🚨 Četník - Počítá písmena a další znaky v textu</p>
        <p className="mt-2 text-xs">Všechna data jsou zpracovávána lokálně ve vašem prohlížeči.</p>
      </footer>
    </div>
  );
};

export default App;
