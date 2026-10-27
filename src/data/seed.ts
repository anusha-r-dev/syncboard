import { initialRank } from '../features/board/fractionalOrder'
import type { Board, Card, Column, Label } from '../features/sync/types'

const zeroClock = { counter: 0, clientId: 'seed' }
const now = 1_730_000_000_000

export const labels: Record<string, Label> = {
  product: { id: 'product', name: 'Product', color: 'violet' },
  design: { id: 'design', name: 'Design', color: 'rose' },
  engineering: { id: 'engineering', name: 'Engineering', color: 'blue' },
  research: { id: 'research', name: 'Research', color: 'emerald' },
  quality: { id: 'quality', name: 'Quality', color: 'amber' },
}

export const seedBoard: Board = {
  id: 'product-launch',
  title: 'Product launch',
  description: 'Plan and ship the next customer workspace release.',
  updatedAt: now,
  version: 1,
}

const columnNames = ['Backlog', 'In Progress', 'Review', 'Done']

export const seedColumns: Column[] = columnNames.map((title, index) => ({
  id: title.toLowerCase().replaceAll(' ', '-'),
  boardId: seedBoard.id,
  title,
  order: initialRank(index, columnNames.length),
  updatedAt: now,
  version: 1,
  fieldClocks: { title: zeroClock, order: zeroClock },
}))

type SeedCard = {
  title: string
  description: string
  columnId: string
  labelIds: string[]
  assignee: string
}

const cardSeeds: SeedCard[] = [
  {
    title: 'Interview pilot customers',
    description: 'Capture the highest-friction collaboration workflows from six teams.',
    columnId: 'backlog',
    labelIds: ['research', 'product'],
    assignee: 'Maya',
  },
  {
    title: 'Draft launch checklist',
    description: 'Document owners, dates, dependencies, and rollback decisions.',
    columnId: 'backlog',
    labelIds: ['product'],
    assignee: 'Alex',
  },
  {
    title: 'Audit mobile navigation',
    description:
      'Validate touch targets and horizontal board navigation on small screens.',
    columnId: 'backlog',
    labelIds: ['design', 'quality'],
    assignee: 'Nora',
  },
  {
    title: 'Build keyboard drag flow',
    description: 'Support lift, movement, drop, and screen-reader announcements.',
    columnId: 'in-progress',
    labelIds: ['engineering', 'quality'],
    assignee: 'Jordan',
  },
  {
    title: 'Define workspace permissions',
    description: 'Map owner, editor, and viewer capabilities for the first release.',
    columnId: 'in-progress',
    labelIds: ['product', 'engineering'],
    assignee: 'Maya',
  },
  {
    title: 'Prototype activity timeline',
    description: 'Make remote changes understandable without overwhelming the board.',
    columnId: 'in-progress',
    labelIds: ['design'],
    assignee: 'Sam',
  },
  {
    title: 'Review offline conflict copy',
    description: 'Keep conflict messaging calm, specific, and recoverable.',
    columnId: 'review',
    labelIds: ['product', 'quality'],
    assignee: 'Alex',
  },
  {
    title: 'Test 1,000-card performance',
    description: 'Record first render, scroll responsiveness, and memory behavior.',
    columnId: 'review',
    labelIds: ['engineering', 'quality'],
    assignee: 'Jordan',
  },
  {
    title: 'Finalize label palette',
    description: 'Confirm AA contrast in light and dark themes.',
    columnId: 'review',
    labelIds: ['design', 'quality'],
    assignee: 'Nora',
  },
  {
    title: 'Create product brief',
    description: 'Align the team around customer problem, scope, and success signals.',
    columnId: 'done',
    labelIds: ['product'],
    assignee: 'Maya',
  },
  {
    title: 'Set up CI quality gates',
    description: 'Run formatting, linting, type checks, tests, build, and browser tests.',
    columnId: 'done',
    labelIds: ['engineering', 'quality'],
    assignee: 'Jordan',
  },
  {
    title: 'Approve interaction principles',
    description: 'Document motion, focus, feedback, and empty-state conventions.',
    columnId: 'done',
    labelIds: ['design'],
    assignee: 'Sam',
  },
]

const countsByColumn = new Map<string, number>()

export const seedCards: Card[] = cardSeeds.map((seed, index) => {
  const position = countsByColumn.get(seed.columnId) ?? 0
  countsByColumn.set(seed.columnId, position + 1)
  return {
    id: `card-${index + 1}`,
    title: seed.title,
    description: seed.description,
    labels: seed.labelIds
      .map((id) => labels[id])
      .filter((label): label is Label => !!label),
    assignee: seed.assignee,
    columnId: seed.columnId,
    order: initialRank(position, 20),
    updatedAt: now + index,
    version: 1,
    fieldClocks: {
      title: zeroClock,
      description: zeroClock,
      labels: zeroClock,
      assignee: zeroClock,
      columnId: zeroClock,
      order: zeroClock,
    },
  }
})
