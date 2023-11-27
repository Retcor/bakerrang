import React from 'react'
import { Input } from '@material-tailwind/react'

const InputWrapper = ({ value, setValue, label, defaultValue, className, children }) => {
  return (
    <div className={`bg-gray-700 rounded-[7px] ${className}`}>
      <Input
        defaultValue={defaultValue}
        className='text-white border-none outline-none placeholder-shown:border-none focus:!border-none'
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
