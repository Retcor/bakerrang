import React from 'react'

const paths = {
  back: <path d='m15 18-6-6 6-6' />,
  edit: <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z' />,
  eye: <><path d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z' /><circle cx='12' cy='12' r='3' /></>,
  eyeOff: <><path d='m3 3 18 18' /><path d='M9.8 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.1 3.5M6.2 8.1C3.5 9.8 2 12 2 12s3.5 6 10 6c1.1 0 2.1-.2 3-.5' /></>,
  copy: <><rect x='8' y='8' width='12' height='12' rx='2' /><path d='M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3' /></>,
  check: <path d='m4 12 5 5L20 6' />,
  open: <><path d='M13 4h7v7M20 4l-9 9' /><path d='M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5' /></>,
  upload: <path d='M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5' />,
  download: <path d='M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3' />,
  clock: <><circle cx='12' cy='12' r='9' /><path d='M12 7v5l3 2' /></>,
  trash: <><path d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' /><path d='M10 11v5M14 11v5' /></>,
  plus: <path d='M12 5v14M5 12h14' />,
  minus: <path d='M5 12h14' />,
  search: <><circle cx='11' cy='11' r='7' /><path d='m16 16 5 5' /></>,
  menu: <><circle cx='12' cy='5' r='1' /><circle cx='12' cy='12' r='1' /><circle cx='12' cy='19' r='1' /></>,
  lock: <><rect x='5' y='10' width='14' height='11' rx='2' /><path d='M8 10V7a4 4 0 0 1 8 0v3' /></>,
  people: <><circle cx='9' cy='8' r='3' /><path d='M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1' /></>,
  down: <path d='m6 9 6 6 6-6' />,
  grip: <><circle cx='9' cy='5' r='1' /><circle cx='15' cy='5' r='1' /><circle cx='9' cy='12' r='1' /><circle cx='15' cy='12' r='1' /><circle cx='9' cy='19' r='1' /><circle cx='15' cy='19' r='1' /></>
}

export const Icon = ({ name }) => <svg aria-hidden='true' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>{paths[name]}</svg>

export const IconButton = ({ icon, label, className = '', ...props }) => <button type='button' className={`pw-icon-button ${className}`.trim()} aria-label={label} {...props}><Icon name={icon} /></button>
