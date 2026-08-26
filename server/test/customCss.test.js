import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CUSTOM_CSS_MAX_BYTES,
  normalizeStoredCustomCss,
  scopeCustomCss,
  validateCustomCss
} from '../domain/customCss.js'

test('validateCustomCss preserves valid raw CSS and canonicalizes blank CSS to absence', () => {
  const css = '/* safe */\n.card { color: red; }'
  assert.equal(validateCustomCss(css), css)
  assert.equal(validateCustomCss(' \n\t '), undefined)
  assert.throws(() => validateCustomCss(null), { code: 'INVALID_CUSTOM_CSS', status: 400 })
})

test('validateCustomCss reports controlled syntax errors with useful line positions', () => {
  assert.throws(
    () => validateCustomCss('.card {\n  color: red;'),
    (error) => error.code === 'INVALID_CUSTOM_CSS' && error.status === 400 && /line 1/.test(error.message)
  )
  assert.throws(
    () => validateCustomCss('.card { color: red; }\n.other,,.last { color: blue }'),
    (error) => error.code === 'INVALID_CUSTOM_CSS' && /line 2/.test(error.message)
  )
})

test('validateCustomCss enforces the UTF-8 byte limit', () => {
  assert.equal(validateCustomCss(`/*${'a'.repeat(CUSTOM_CSS_MAX_BYTES - 4)}*/`), `/*${'a'.repeat(CUSTOM_CSS_MAX_BYTES - 4)}*/`)
  assert.throws(() => validateCustomCss('é'.repeat((CUSTOM_CSS_MAX_BYTES / 2) + 1)), /at most 20480 bytes/)
})

test('validateCustomCss allows only media, supports, and keyframes at-rules', () => {
  assert.doesNotThrow(() => validateCustomCss('@media (min-width: 40rem){.card{display:grid}}@supports(display:grid){.card{display:grid}}@keyframes pulse{from{opacity:0}to{opacity:1}}'))
  const blocked = {
    import: '@import "theme.css";',
    'font-face': '@font-face{font-family:test;src:local(test)}',
    layer: '@layer theme{.card{color:red}}',
    property: '@property --tone{syntax:"<color>";inherits:false;initial-value:red}',
    namespace: '@namespace svg "http://www.w3.org/2000/svg";',
    page: '@page{margin:1cm}',
    document: '@document regexp(".*"){.card{color:red}}',
    charset: '@charset "UTF-8";',
    container: '@container card (width > 10rem){.card{color:red}}',
    unknown: '@unknown test{.card{color:red}}'
  }
  for (const [name, css] of Object.entries(blocked)) {
    assert.throws(() => validateCustomCss(css), new RegExp(`@${name} is not allowed`))
  }
})

test('validateCustomCss rejects URL nodes and resource-producing functions through the AST', () => {
  for (const css of [
    '.card{background:url("https://example.com/a.png")}',
    '.card{--image:url(data:image/png;base64,abc)}',
    '.card{filter:url(#filter)}',
    '.card{background:image-set("a.png" 1x)}',
    '.card{background:-webkit-image-set("a.png" 1x)}',
    '.card{background:image("a.png")}',
    '.card{content:src("a.woff2")}'
  ]) assert.throws(() => validateCustomCss(css), { code: 'INVALID_CUSTOM_CSS' })
})

test('AST validation ignores comments and quoted text that merely resemble blocked syntax', () => {
  const css = '/* @import url(evil.css); image-set("evil.png" 1x) */ .card::before{content:"@import url(evil.css) image-set(evil.png) </style>"}'
  assert.equal(validateCustomCss(css), css)
})

test('scopeCustomCss scopes selector lists, universal selectors, pseudos, and existing roots', () => {
  assert.equal(
    scopeCustomCss('.foo, *:hover, [data-br-site] .ready::before{color:red}'),
    '[data-br-site] .foo,[data-br-site] *:hover,[data-br-site] .ready::before{color:red}'
  )
})

test('scopeCustomCss replaces leading document roots while preserving the rest of the compound', () => {
  assert.equal(scopeCustomCss('body.foo .card{a:b}'), '[data-br-site].foo .card{a:b}')
  assert.equal(scopeCustomCss('html.dark h1{a:b}'), '[data-br-site].dark h1{a:b}')
  assert.equal(scopeCustomCss(':root[data-layout="wide"] button{a:b}'), '[data-br-site][data-layout="wide"] button{a:b}')
  assert.equal(scopeCustomCss('body > main{a:b}'), '[data-br-site]>main{a:b}')
})

test('scopeCustomCss rejects document roots later in a selector', () => {
  assert.throws(() => scopeCustomCss('.wrapper body .card{color:red}'), /only allowed in the leading selector compound/)
  assert.throws(() => scopeCustomCss('.wrapper:is(body,.card){color:red}'), /only allowed in the leading selector compound/)
})

test('scopeCustomCss recursively scopes media and supports rules but leaves keyframe steps untouched', () => {
  assert.equal(
    scopeCustomCss('@media (min-width:40rem){.card{display:grid}}@supports (display:grid){body main{display:grid}}@keyframes pulse{from{opacity:0}50%{opacity:.5}to{opacity:1}}'),
    '@media (min-width:40rem){[data-br-site] .card{display:grid}}@supports (display:grid){[data-br-site] main{display:grid}}@keyframes pulse{from{opacity:0}50%{opacity:.5}to{opacity:1}}'
  )
})

test('scopeCustomCss preserves nested pseudo selector semantics and escapes style breakouts', () => {
  const scoped = scopeCustomCss('.card:is(.featured,.wide):not(.hidden)::before{content:"</style><script>"}')
  assert.match(scoped, /^\[data-br-site\] \.card:is\(\.featured,\.wide\):not\(\.hidden\)::before/)
  assert.equal(scoped.includes('<'), false)
  assert.match(scoped, /\\3c \/style>\\3c script>/)
})

test('normalizeStoredCustomCss never throws and fails closed', () => {
  assert.equal(normalizeStoredCustomCss('.card{color:red}'), '[data-br-site] .card{color:red}')
  assert.equal(normalizeStoredCustomCss('@import "evil.css";'), undefined)
  assert.equal(normalizeStoredCustomCss({ css: '.card{}' }), undefined)
})
