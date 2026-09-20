'use client'

import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from 'react'
import { Button, StatusMessage } from '@bakerrang/ui'
import { websiteEditorById, type WebsiteEditorId } from './websiteEditors'

export type WebsiteEditorWidth = 'form' | 'wide'

export interface ActiveEditorController {
  dirty: boolean
  canSave: boolean
  saving: boolean
  save: () => void
}

export interface WebsiteEditorShellProps {
  children: ReactNode
  dirtyValue: unknown
  editor: WebsiteEditorId
  error?: string | null
  chrome?: 'card' | 'rail'
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange: (dirty: boolean) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  saveDisabled?: boolean
  saving: boolean
  secondaryActions?: ReactNode
  width?: WebsiteEditorWidth
}

function comparable (value: unknown) {
  return JSON.stringify(value)
}

export function WebsiteEditorShell ({ children, chrome = 'card', dirtyValue, editor, error, onBack, onCancel, onControllerChange, onDirtyChange, onSubmit, saveDisabled = false, saving, secondaryActions, width = 'form' }: WebsiteEditorShellProps) {
  const metadata = websiteEditorById.get(editor)
  const [initialValue] = useState(() => comparable(dirtyValue))
  const formRef = useRef<HTMLFormElement>(null)
  const dirty = comparable(dirtyValue) !== initialValue

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  useEffect(() => {
    if (chrome !== 'rail') return
    onControllerChange?.({
      dirty,
      canSave: dirty && !saveDisabled && !saving,
      saving,
      save: () => formRef.current?.requestSubmit()
    })
  }, [chrome, dirty, onControllerChange, saveDisabled, saving])

  useEffect(() => () => {
    if (chrome === 'rail') onControllerChange?.(null)
  }, [chrome, onControllerChange])

  if (!metadata) return null

  if (chrome === 'rail') return (
    <form className="flex min-h-0 min-w-0 flex-1 flex-col text-left" noValidate onSubmit={onSubmit} ref={formRef}>
      <header className="shrink-0 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <button aria-label="Site tools" className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-semibold text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onBack ?? onCancel} type="button"><svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>Site tools</button>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">{metadata.launcherLabel ?? metadata.label}</h2>
        <p className="mt-1 text-sm leading-5 text-fg-muted">{metadata.description}</p>
      </header>
      <div className="website-tool-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
        {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
      </div>
    </form>
  )

  return (
    <form className={`min-w-0 w-full ${width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'} rounded-lg border border-border bg-surface text-left shadow-xs`} noValidate onSubmit={onSubmit} ref={formRef}>
      <header className="border-b border-border px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">{metadata.group}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">{metadata.label}</h2>
        <p className="mt-1 text-sm leading-6 text-fg-muted">{metadata.description}</p>
      </header>
      <div className="min-w-0 p-5 sm:p-6">
        {children}
        {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
      </div>
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid="website-editor-actions">
        {secondaryActions && <div className="flex min-w-0 flex-wrap gap-2" data-testid="website-editor-secondary-actions">{secondaryActions}</div>}
        <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto" data-testid="website-editor-primary-actions">
          <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
          <Button disabled={saving || saveDisabled} type="submit">{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </form>
  )
}
