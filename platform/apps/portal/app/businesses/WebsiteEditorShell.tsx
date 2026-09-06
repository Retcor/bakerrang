'use client'

import { useEffect, useState, type FormEventHandler, type ReactNode } from 'react'
import { Button, StatusMessage } from '@bakerrang/ui'
import { sectionDefinitions, type SectionEditorKey } from './sectionDefinitions'
import { websiteEditorById, type WebsiteEditorId } from './websiteEditors'

export type WebsiteEditorWidth = 'form' | 'wide'

export interface WebsiteEditorShellProps {
  children: ReactNode
  dirtyValue: unknown
  editor: WebsiteEditorId | SectionEditorKey
  error?: string | null
  onCancel: () => void
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

export function WebsiteEditorShell ({ children, dirtyValue, editor, error, onCancel, onDirtyChange, onSubmit, saveDisabled = false, saving, secondaryActions, width = 'form' }: WebsiteEditorShellProps) {
  const metadata = websiteEditorById.get(editor as WebsiteEditorId) ?? Object.values(sectionDefinitions).find((definition) => definition.editor === editor)
  const [initialValue] = useState(() => comparable(dirtyValue))
  const dirty = comparable(dirtyValue) !== initialValue

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  if (!metadata) return null

  return (
    <form className={`min-w-0 w-full ${width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'} rounded-lg border border-border bg-surface text-left shadow-xs`} noValidate onSubmit={onSubmit}>
      <header className="border-b border-border px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">{'group' in metadata ? metadata.group : 'Homepage'}</p>
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
