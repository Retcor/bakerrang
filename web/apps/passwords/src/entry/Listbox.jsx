import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'

export const Listbox = ({ id, value, options, onChange, label }) => {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const list = useRef(null)
  const selected = Math.max(0, options.findIndex((option) => option.value === value))
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => { if (open) list.current?.focus() }, [open])
  const choose = (index) => { onChange(options[index].value); setActive(index); setOpen(false); root.current?.querySelector('button')?.focus() }
  const keyboard = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); root.current?.querySelector('button')?.focus() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive((n) => (n + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length) }
    if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1) }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active) }
  }
  return <div className='pw-listbox' ref={root}><button id={id} type='button' className='pw-field pw-listbox-button' aria-haspopup='listbox' aria-expanded={open} aria-controls={`${id}-options`} aria-label={label} onClick={() => { setActive(selected); setOpen(!open) }}>{options[selected]?.label}<Icon name='down' /></button>{open && <div id={`${id}-options`} ref={list} tabIndex='0' role='listbox' aria-label={label} aria-activedescendant={`${id}-option-${active}`} className='pw-listbox-options' onKeyDown={keyboard}>{options.map((option, index) => <button id={`${id}-option-${index}`} key={option.value ?? 'none'} type='button' role='option' aria-selected={index === selected} className={index === active ? 'is-active' : ''} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>{option.label}</button>)}</div>}</div>
}
