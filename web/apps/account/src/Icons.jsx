import React from 'react'

// Drawn icons at the world's 1.75 stroke. Decorative: the label next to each one names it.
const PATHS = {
  plus: <path d='M12 5v14M5 12h14' />,
  sun: <><circle cx='12' cy='12' r='4' /><path d='M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19' /></>,
  moon: <path d='M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z' />,
  system: <><rect x='3' y='4' width='18' height='12' rx='1.5' /><path d='M8 20h8M12 16v4' /></>,
  ext: <path d='M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4' />,
  mic: <><rect x='9' y='3' width='6' height='11' rx='3' /><path d='M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21' /></>,
  upload: <path d='M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15' />,
  wave: <path d='M4 12h1.5M7.5 8v8M11 5v14M14.5 9v6M18 7v10M20.5 12H20' />,
  play: <path d='M8 5.5v13l10.5-6.5z' />,
  pause: <path d='M8.5 5.5v13M15.5 5.5v13' />,
  stop: <rect x='6.5' y='6.5' width='11' height='11' rx='1.5' />,
  x: <path d='M6 6l12 12M18 6L6 18' />,
  check: <path d='M5 12.5l4.5 4.5L19 7.5' />,
  alert: <><circle cx='12' cy='12' r='9' /><path d='M12 7.5v5.5M12 16.2v.1' /></>,
  info: <><circle cx='12' cy='12' r='9' /><path d='M12 11v5.5M12 7.8v.1' /></>,
  offline: <path d='M3 3l18 18M8.5 8.8A8.9 8.9 0 0 0 3.5 11.5M20.5 11.5a8.9 8.9 0 0 0-5.3-2.7M6.8 14.8a5.3 5.3 0 0 1 3-1.7M14.4 13.2a5.4 5.4 0 0 1 2.8 1.6M12 19h.01' />,
  signout: <><path d='M15 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9' /><path d='M18 15l3-3-3-3M10 12h11' /></>,
  arrow: <path d='M5 12h14M13 6l6 6-6 6' />,
  back: <path d='M19 12H5M11 6l-6 6 6 6' />
}

export const Icon = ({ name, className = 'ac-i' }) => (
  <svg className={className} viewBox='0 0 24 24' aria-hidden='true' focusable='false'>{PATHS[name]}</svg>
)

export const GoogleIcon = () => (
  <svg className='ac-gicon' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
    <path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' />
  </svg>
)
