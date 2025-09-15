import React from 'react'
import { Input } from '@material-tailwind/react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const InputWrapper = ({ value, setValue, label, defaultValue, className, children }) => {
  const { isDark } = useTheme()

  return (
    <div className={`rounded-[7px] transition-all duration-300 ${isDark ? 'glass-dark' : 'glass-light'} ${className}`}>
      <Input
        defaultValue={defaultValue}
        className={`border-none outline-none placeholder-shown:border-none focus:!border-none ${isDark ? 'text-theme-dark placeholder:text-theme-secondary-dark' : 'text-theme-light placeholder:text-theme-secondary-light'}`}
        labelProps={{
          className: 'before:!border-none after:!border-none !text-[#D4ED31]'
        }}
        label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {children}
      </Input>
    </div>
  )
}

export default InputWrapper
