import React, { useEffect, useRef } from 'react'

export const Button = React.forwardRef(({ variant = 'ghost', size = 'default', className = '', ...props }, ref) => (
  <button ref={ref} className={`br-button br-button--${variant} br-button--${size} ${className}`.trim()} {...props} />
))

export const IconButton = React.forwardRef(({ className = '', ...props }, ref) => (
  <button ref={ref} className={`br-icon-button ${className}`.trim()} {...props} />
))

export const useDismiss = ({ open, onDismiss, documentObject = document }) => {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && ref.current?.contains(event.target)) return
      onDismiss()
    }
    documentObject.addEventListener('pointerdown', close)
    documentObject.addEventListener('keydown', close)
    return () => {
      documentObject.removeEventListener('pointerdown', close)
      documentObject.removeEventListener('keydown', close)
    }
  }, [documentObject, onDismiss, open])

  return ref
}
