import React from 'react'
import { Input } from '@material-tailwind/react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const InputWrapper = ({ value, setValue, label, defaultValue, className, children, onKeyDown }) => {
  const { isDark } = useTheme()

  return (
    <div className={`rounded-[7px] transition-all duration-300 ${isDark ? 'glass-dark' : 'glass-light'} ${className}`}>
      <Input
        defaultValue={defaultValue}
        className={`border-none outline-none placeholder-shown:border-none focus:!border-none ${isDark ? 'text-theme-dark placeholder:text-theme-secondary-dark' : 'text-theme-light placeholder:text-theme-secondary-light'}`}
        labelProps={{
          className: `before:!border-none after:!border-none ${isDark ? '!text-white/80' : '!text-gray-600'}`
        }}
        label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      >
        {children}
      </Input>
    </div>
  )
}

export default InputWrapper
