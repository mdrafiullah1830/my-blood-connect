// auto-translation — MyMemory free API (no key) diye chat message translate hoy.
// offline/failure e original text-i return hoy, app kono din break kore na.

const cache = new Map();

export const translateText = async (text, targetLang) => {
  const sourceLang = targetLang === 'bn' ? 'en' : 'bn';
  const key = `${text}|${sourceLang}|${targetLang}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`translation failed: ${response.status}`);
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (!translated) throw new Error('empty translation');
    const result = { translated, ok: true };
    cache.set(key, result);
    return result;
  } catch {
    return { translated: text, ok: false };
  }
};
