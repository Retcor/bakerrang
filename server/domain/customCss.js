import * as csstree from 'css-tree'

export const CUSTOM_CSS_MAX_BYTES = 20 * 1024

const SCOPE_ATTRIBUTE = 'data-br-site'
const ALLOWED_AT_RULES = new Set(['media', 'supports', 'keyframes'])
const RESOURCE_FUNCTIONS = new Set([
  'image',
  'image-set',
  '-webkit-image-set',
  'src'
])

const scopeSelector = csstree.parse(`[${SCOPE_ATTRIBUTE}]`, { context: 'selector' })
const scopeNode = scopeSelector.children.first

function policyError (message, node) {
  const line = node?.line || node?.loc?.line || node?.loc?.start?.line
  const error = new Error(line ? `${message} (line ${line}).` : `${message}.`)
  error.code = 'INVALID_CUSTOM_CSS'
  error.status = 400
  return error
}

function tokenNode (css, offset) {
  return { line: css.slice(0, offset).split('\n').length }
}

function validateTokenBalance (css) {
  const { BadString, BadUrl, Function, LeftCurlyBracket, LeftParenthesis, LeftSquareBracket, RightCurlyBracket, RightParenthesis, RightSquareBracket } = csstree.tokenTypes
  const closingToken = new Map([
    [Function, RightParenthesis],
    [LeftCurlyBracket, RightCurlyBracket],
    [LeftParenthesis, RightParenthesis],
    [LeftSquareBracket, RightSquareBracket]
  ])
  const stack = []

  csstree.tokenize(css, (type, start) => {
    if (type === BadString || type === BadUrl) {
      throw policyError('Custom CSS contains invalid syntax', tokenNode(css, start))
    }
    const expected = closingToken.get(type)
    if (expected) {
      stack.push({ expected, start })
      return
    }
    if (type === RightCurlyBracket || type === RightParenthesis || type === RightSquareBracket) {
      if (stack.pop()?.expected !== type) {
        throw policyError('Custom CSS contains invalid syntax', tokenNode(css, start))
      }
    }
  })

  if (stack.length > 0) {
    throw policyError('Custom CSS contains invalid syntax', tokenNode(css, stack.at(-1).start))
  }
}

function parseCss (css) {
  const recoveries = []
  try {
    validateTokenBalance(css)
    const ast = csstree.parse(css, {
      positions: true,
      parseCustomProperty: true,
      onParseError: (error) => recoveries.push(error)
    })
    if (recoveries.length > 0) {
      throw policyError('Custom CSS contains invalid syntax', recoveries[0])
    }
    return ast
  } catch (error) {
    if (error?.code === 'INVALID_CUSTOM_CSS') throw error
    const line = error?.line || error?.loc?.line
    throw policyError('Custom CSS contains invalid syntax', line ? { loc: { start: { line } } } : undefined)
  }
}

function attributeName (node) {
  if (node?.type !== 'AttributeSelector') return null
  return typeof node.name === 'string' ? node.name : node.name?.name
}

function isScopeNode (node) {
  return attributeName(node)?.toLowerCase() === SCOPE_ATTRIBUTE && node.matcher === null
}

function isRootLike (node) {
  if (node.type === 'TypeSelector') {
    const name = node.name.toLowerCase()
    return name === 'body' || name === 'html'
  }
  return node.type === 'PseudoClassSelector' && node.name.toLowerCase() === 'root'
}

function scopeOneSelector (selector) {
  const directNodes = selector.children.toArray()
  const firstCombinator = directNodes.findIndex((node) => node.type === 'Combinator')
  const compoundEnd = firstCombinator === -1 ? directNodes.length : firstCombinator
  const leadingCompound = directNodes.slice(0, compoundEnd)
  const leadingScope = leadingCompound.find(isScopeNode)
  const leadingRoot = leadingCompound.find(isRootLike)
  let unsupportedRoot

  csstree.walk(selector, (node) => {
    if (isRootLike(node) && node !== leadingRoot) unsupportedRoot = node
  })
  if (unsupportedRoot) {
    throw policyError('html, body, and :root are only allowed in the leading selector compound', unsupportedRoot)
  }

  if (leadingScope) return
  if (leadingRoot) {
    const index = directNodes.indexOf(leadingRoot)
    directNodes[index] = csstree.clone(scopeNode)
  } else {
    directNodes.unshift({ type: 'Combinator', loc: null, name: ' ' })
    directNodes.unshift(csstree.clone(scopeNode))
  }

  selector.children.clear()
  directNodes.forEach((node) => selector.children.appendData(node))
}

function scopeRules (children, inKeyframes = false) {
  children.forEach((node) => {
    if (node.type === 'Atrule') {
      if (node.block) scopeRules(node.block.children, inKeyframes || node.name.toLowerCase() === 'keyframes')
      return
    }
    if (node.type !== 'Rule' || inKeyframes) return
    if (node.prelude?.type !== 'SelectorList') {
      throw policyError('Custom CSS contains an unsupported selector', node)
    }
    node.prelude.children.forEach(scopeOneSelector)
  })
}

function validateAst (ast) {
  csstree.walk(ast, (node) => {
    if (node.type === 'Atrule' && !ALLOWED_AT_RULES.has(node.name.toLowerCase())) {
      throw policyError(`@${node.name} is not allowed in Custom CSS`, node)
    }
    if (node.type === 'Url') {
      throw policyError('External resource URLs are not allowed in Custom CSS', node)
    }
    if (node.type === 'Function' && RESOURCE_FUNCTIONS.has(node.name.toLowerCase())) {
      throw policyError(`${node.name}() is not allowed in Custom CSS`, node)
    }
  })
}

function validatedAst (css) {
  const ast = parseCss(css)
  validateAst(ast)
  scopeRules(csstree.clone(ast).children)
  return ast
}

export function validateCustomCss (value) {
  if (typeof value !== 'string') throw policyError('Custom CSS must be a string')
  if (Buffer.byteLength(value, 'utf8') > CUSTOM_CSS_MAX_BYTES) {
    throw policyError(`Custom CSS must be at most ${CUSTOM_CSS_MAX_BYTES} bytes`)
  }
  if (value.trim() === '') return undefined
  validatedAst(value)
  return value
}

export function scopeCustomCss (value) {
  const validated = validateCustomCss(value)
  if (validated === undefined) return undefined
  const ast = validatedAst(validated)
  scopeRules(ast.children)
  return csstree.generate(ast).replaceAll('<', '\\3c ')
}

export function normalizeStoredCustomCss (value) {
  try {
    return scopeCustomCss(value)
  } catch {
    return undefined
  }
}
