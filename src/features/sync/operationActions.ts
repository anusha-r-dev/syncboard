import { createAction } from '@reduxjs/toolkit'
import type { OperationDraft } from './types'

export const operationRequested = createAction<{
  draft: OperationDraft
  recordHistory?: boolean
  undoOf?: string
}>('sync/operationRequested')

export const undoRequested = createAction('history/undoRequested')
export const redoRequested = createAction('history/redoRequested')
