import React from 'react'
import { FieldError } from './FieldError.jsx'

export const DayRule = ({ value, onChange, invalid, label = 'Due every month on', hint }) => {
  const setRule = (rule) => onChange({ rule, ...(rule === 'day' ? { day: value?.day || 1 } : {}) })
  const onKeyDown = (event) => {
    const rules = ['day', 'first', 'last']; const index = rules.indexOf(value?.rule)
    let next = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % rules.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + 2) % rules.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = rules.length - 1
    if (next !== null) { event.preventDefault(); setRule(rules[next]); event.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus() }
  }
  const setDay = (text) => { const digits = text.replace(/\D/g, '').slice(0, 2); onChange({ rule: 'day', day: digits ? Number(digits) : null }) }
  const shortMonthHint = hint ?? (value?.rule === 'day' && value.day > 28 ? 'In shorter months it is due on the last day.' : null)
  return (
    <fieldset className='bd-field bd-field--wide'>
      <legend>{label}</legend>
      <div className='bd-inline'>
        <div className='bd-segments' role='radiogroup' aria-label={label} onKeyDown={onKeyDown}>{[['day', 'Day'], ['first', 'First day'], ['last', 'Last day']].map(([rule, optionLabel]) => <button key={rule} type='button' role='radio' aria-checked={value?.rule === rule} tabIndex={value?.rule === rule ? 0 : -1} onClick={() => setRule(rule)}>{optionLabel}</button>)}</div>
        {value?.rule === 'day' && <input id='bd-day' className='bd-day-input' type='text' inputMode='numeric' autoComplete='off' placeholder='1–31' aria-label='Day of the month, 1 to 31' value={value.day ?? ''} aria-invalid={invalid || undefined} onChange={(event) => setDay(event.target.value)} />}
      </div>
      {invalid && <FieldError>Enter a day from 1 to 31.</FieldError>}
      {shortMonthHint && <small className='bd-hint-text'>{shortMonthHint}</small>}
    </fieldset>
  )
}
