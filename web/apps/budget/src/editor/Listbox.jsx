import React, { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../Icons.jsx'

export const Listbox = ({ label, value, options, onChange, className = '', hideLabel = false }) => {
  const [open, setOpen] = useState(false); const [active, setActive] = useState(Math.max(0, options.findIndex((option) => option.value === value)))
  const id = useId(); const root = useRef(null)
  useEffect(() => { const dismiss = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }; document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss) }, [])
  const choose = (index) => { onChange(options[index].value); setActive(index); setOpen(false) }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setOpen(true); setActive(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))) }
    if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); choose(active) }
  }
  const current = options.find((option) => option.value === value) || options[0]
  return <label className={`bd-field bd-listbox ${className}`.trim()} ref={root}><span className={hideLabel ? 'bd-sr' : undefined}>{label}</span><button type='button' aria-haspopup='listbox' aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} onKeyDown={onKeyDown}><span className='bd-listbox__value'>{current?.label}</span><ChevronDownIcon /></button>{open && <div id={id} role='listbox' aria-activedescendant={`${id}-${active}`} tabIndex='-1'>{options.map((option, index) => <button type='button' role='option' id={`${id}-${index}`} aria-selected={option.value === value} className={index === active ? 'is-active' : ''} key={String(option.value)} onPointerMove={() => setActive(index)} onClick={() => choose(index)}><CheckIcon /><span>{option.label}{option.description && <small>{option.description}</small>}</span></button>)}</div>}</label>
}
