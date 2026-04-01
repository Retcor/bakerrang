import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../providers/ThemeProvider.jsx'
import { SERVER_PREFIX } from '../../App.jsx'

const WoWChat = ({ character, savedState }) => {
  const { isDark } = useTheme()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `I've loaded **${character.name}'s** profile — ${character.spec} ${character.class} with ${character.equippedIlvl} ilvl${character.mPlusScore ? ` and a ${character.mPlusScore} M+ score` : ''}. Ask me anything about improving your character!`
    }
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMessage = { role: 'user', content: text }
    const historyForRequest = messages.filter(m => m.role !== 'system')

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch(`${SERVER_PREFIX}/wow/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          characterData: character,
          history: historyForRequest
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Sorry, something went wrong: ${err.error || 'Unknown error'}` }
          return updated
        })
        setIsStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const { text: chunk } = JSON.parse(data)
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: 'assistant',
                content: updated[updated.length - 1].content + chunk
              }
              return updated
            })
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Connection error. Please check your network and try again.'
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const cardClass = isDark ? 'glass-card-dark' : 'glass-card-light'
  const textClass = isDark ? 'text-white' : 'text-gray-900'
  const secondaryText = isDark ? 'text-white/60' : 'text-gray-500'
  const inputBg = isDark ? 'bg-black/30 border-white/10 text-white placeholder-white/30' : 'bg-white/60 border-black/10 text-gray-900 placeholder-gray-400'
  const sendBtnClass = isStreaming
    ? 'bg-gray-500 cursor-not-allowed text-white'
    : isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'

  return (
    <div className={`rounded-2xl ${cardClass} ${textClass} flex flex-col h-full`} style={{ minHeight: 520 }}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className='flex items-center gap-2'>
          <h3 className={`font-semibold text-base ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>WoW Advisor</h3>
          {savedState === 'saved' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              Data synced
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${secondaryText}`}>Ask about gear, M+, raids, talents, and more</p>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4' style={{ maxHeight: 400 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? isDark ? 'bg-accent-dark text-gray-900 rounded-br-sm' : 'bg-accent-light text-white rounded-br-sm'
                  : isDark ? 'bg-white/10 text-white rounded-bl-sm' : 'bg-white/80 text-gray-900 rounded-bl-sm'
              }`}
            >
              {msg.content
                ? renderMessage(msg.content)
                : <span className='inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
              }
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`px-5 py-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className='flex gap-3'>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask about your character...'
            disabled={isStreaming}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors resize-none ${inputBg} ${isDark ? 'focus:border-[#D4ED31]/50' : 'focus:border-[#1e40af]/50'}`}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${sendBtnClass}`}
          >
            {isStreaming ? (
              <span className='inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin' />
            ) : (
              'Send'
            )}
          </button>
        </div>
        <p className={`text-xs mt-2 ${secondaryText}`}>Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

// Simple markdown-ish renderer for bold and line breaks
function renderMessage(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part.split('\n').map((line, j, arr) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </React.Fragment>
    ))
  })
}

export default WoWChat
