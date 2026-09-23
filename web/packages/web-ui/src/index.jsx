import React from 'react'

export const Button = ({ variant = 'ghost', size = 'default', className = '', ...props }) => (
  <button className={`br-button br-button--${variant} br-button--${size} ${className}`.trim()} {...props} />
)

export const IconButton = ({ className = '', ...props }) => (
  <button className={`br-icon-button ${className}`.trim()} {...props} />
)
