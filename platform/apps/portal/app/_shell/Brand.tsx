import Image from 'next/image'

export function Brand ({ compact = false, surface = 'dark' }: { compact?: boolean, surface?: 'dark' | 'light' }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image alt="" aria-hidden height={40} priority src="/bakerrang-logo.png" width={40} />
      {!compact && (
        <span aria-label="BakerRang" className="text-lg font-bold tracking-tight">
          <span className={surface === 'dark' ? 'text-sidebar-fg' : 'text-fg'}>Baker</span>
          <span className="text-brand">Rang</span>
        </span>
      )}
    </span>
  )
}
