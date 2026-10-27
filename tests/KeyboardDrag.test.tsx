import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { boardReducer } from '../src/features/board/boardSlice'
import { BoardView } from '../src/features/board/BoardView'
import { historyReducer } from '../src/features/history/historySlice'
import { presenceReducer } from '../src/features/presence/presenceSlice'
import { syncReducer } from '../src/features/sync/syncSlice'

describe('keyboard drag', () => {
  it('exposes keyboard instructions and supports the lift/drop sequence', async () => {
    const user = userEvent.setup()
    const store = configureStore({
      reducer: {
        board: boardReducer,
        history: historyReducer,
        presence: presenceReducer,
        sync: syncReducer,
      },
    })
    render(
      <Provider store={store}>
        <BoardView />
      </Provider>,
    )

    const handle = screen.getByRole('button', { name: /move interview pilot customers/i })
    handle.focus()
    await user.keyboard('[Space][ArrowDown][Space]')
    expect(handle).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/press space to lift/i),
    )
    expect(screen.getByText(/press space to lift an item/i)).toBeInTheDocument()
  })
})
