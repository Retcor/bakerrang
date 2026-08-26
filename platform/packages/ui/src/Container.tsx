import type { HTMLAttributes } from 'react'

export type ContainerProps = HTMLAttributes<HTMLDivElement>

export function Container ({ className = '', ...props }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}
      {...props}
    />
  )
}
