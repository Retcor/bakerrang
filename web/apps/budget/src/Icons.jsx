import React from 'react'

const Icon = ({ children, className = '', viewBox = '0 0 20 20', strokeWidth = '1.8' }) => <svg className={`bd-icon ${className}`} viewBox={viewBox} fill='none' stroke='currentColor' strokeWidth={strokeWidth} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>{children}</svg>
const Glyph = ({ children }) => <Icon viewBox='0 0 24 24' strokeWidth='1.75'>{children}</Icon>

export const ChevronLeftIcon = () => <Icon><path d='m12.5 4.5-5 5.5 5 5.5' /></Icon>
export const ChevronRightIcon = () => <Icon><path d='m7.5 4.5 5 5.5-5 5.5' /></Icon>
export const ChevronDownIcon = () => <Icon><path d='m5 7.5 5 5 5-5' /></Icon>
export const PlusIcon = () => <Icon><path d='M10 4v12M4 10h12' /></Icon>
export const DownArrowIcon = () => <Icon><path d='M10 3v13M5.5 11.5 10 16l4.5-4.5' /></Icon>
export const PaydayIcon = () => <Glyph><path d='M4 7h16v10H4z' /><circle cx='12' cy='12' r='2.4' /><path d='M7 10v4M17 10v4' /></Glyph>
export const BillIcon = () => <Glyph><path d='M7 3.5h10v17l-2.5-1.6L12 20.5l-2.5-1.6L7 20.5z' /><path d='M9.5 8h5M9.5 11.5h5' /></Glyph>
export const DebtIcon = () => <Glyph><path d='M4 17h16M6 17V9M10 17V9M14 17V9M18 17V9M3 9l9-5 9 5z' /></Glyph>
export const OneOffIcon = () => <Glyph><rect x='4' y='5.5' width='16' height='14' rx='1.5' /><path d='M4 10h16M8.5 3.5v4M15.5 3.5v4' /><path d='M12 13v3.5' /></Glyph>
export const CheckIcon = () => <Glyph><path d='m5 12.5 4.5 4.5L19 7.5' /></Glyph>
export const AlertIcon = () => <Glyph><path d='M12 4 2.8 19.5h18.4z' /><path d='M12 10v4.2M12 17h.01' /></Glyph>
export const InfoIcon = () => <Glyph><circle cx='12' cy='12' r='8.5' /><path d='M12 11v5M12 8h.01' /></Glyph>
export const CloudIcon = () => <Glyph><path d='M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z' /><path d='M12 11v4M12 17.5h.01' /></Glyph>
export const OfflineIcon = () => <Glyph><path d='M3 3l18 18M8.5 16.4a5 5 0 0 1 7-.1M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.3-1.6M2 9.3a15 15 0 0 1 4.6-2.8M22 9.3A15 15 0 0 0 11.3 5M12 20h.01' /></Glyph>
