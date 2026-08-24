'use client'

import { createContext, useContext, useEffect } from 'react'

export const BusinessNavigationGuardContext = createContext<(dirty: boolean) => void>(() => {})

export function useBusinessNavigationGuard (dirty: boolean) {
  const report = useContext(BusinessNavigationGuardContext)
  useEffect(() => { report(dirty); return () => report(false) }, [dirty, report])
}
