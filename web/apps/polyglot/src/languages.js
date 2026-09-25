export const LANGUAGES = Object.freeze([
  ['English', 'en-US'], ['Arabic', 'ar-EG'], ['Bulgarian', 'bg-BG'], ['Chinese', 'zh-CN'],
  ['Croatian', 'hr-HR'], ['Czech', 'cs-CZ'], ['Danish', 'da-DK'], ['Dutch', 'nl-NL'],
  ['Finnish', 'fi-FI'], ['Filipino', 'fil-PH'], ['French', 'fr-FR'], ['German', 'de-DE'],
  ['Greek', 'el-GR'], ['Hindi', 'hi-IN'], ['Indonesian', 'id-ID'], ['Italian', 'it-IT'],
  ['Japanese', 'ja-JP'], ['Korean', 'ko-KR'], ['Malay', 'ms-MY'], ['Polish', 'pl-PL'],
  ['Portuguese', 'pt-BR'], ['Romanian', 'ro-RO'], ['Russian', 'ru-RU'], ['Slovak', 'sk-SK'],
  ['Spanish', 'es-ES'], ['Swedish', 'sv-SE'], ['Tamil', 'ta-IN'], ['Turkish', 'tr-TR'], ['Ukrainian', 'uk-UA']
].map(([name, code]) => Object.freeze({ name, code, short: code.split('-')[0].toUpperCase() })))

export const languageByCode = (code) => LANGUAGES.find((language) => language.code === code)
