import React from 'react'
import { FieldError } from './FieldError.jsx'

export const MoneyInput = ({ id, value, onChange, invalid, label = 'Amount', optional = false, hint, className = '' }) => (
  <label className={`bd-field ${className}`.trim()} htmlFor={id}><span>{label}{optional && <em className='bd-opt'> (optional)</em>}</span><span className={`bd-money-input ${invalid ? 'is-invalid' : ''}`}><i aria-hidden='true'>$</i><input id={id} type='text' inputMode='decimal' autoComplete='off' placeholder='0.00' value={value} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} /></span>{invalid && <FieldError id={`${id}-error`}>{value.trim() ? (optional ? 'Enter an amount like 2,864.00, or leave it empty.' : 'Enter an amount like 1,234.56, up to $9,999,999.99.') : 'Enter an amount.'}</FieldError>}{hint && <small className='bd-hint-text'>{hint}</small>}</label>
)
