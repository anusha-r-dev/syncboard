import { useEffect, useState } from 'react'

const steps = [
  {
    eyebrow: '01 · Organize',
    title: 'Drag work into focus',
    body: 'Move cards and columns with the pointer—or press Space, use the arrow keys, then Space to drop.',
  },
  {
    eyebrow: '02 · Collaborate',
    title: 'See teammates live',
    body: 'Open a second tab to watch cursors, active editors, and board changes synchronize instantly.',
  },
  {
    eyebrow: '03 · Recover',
    title: 'Undo is collaborative',
    body: 'Press Ctrl/⌘ + Z to send an inverse operation that keeps every connected board consistent.',
  },
  {
    eyebrow: '04 · Stay productive',
    title: 'Work through interruptions',
    body: 'Use Demo controls to go offline. Changes queue locally and replay in order when you reconnect.',
  },
]

export function GuidedTour() {
  const [step, setStep] = useState(() =>
    localStorage.getItem('syncboard-tour-complete') ? steps.length : 0,
  )

  useEffect(() => {
    if (step >= steps.length) return
    const timeout = window.setTimeout(() => setStep((value) => value + 1), 5000)
    return () => window.clearTimeout(timeout)
  }, [step])

  if (step >= steps.length) {
    localStorage.setItem('syncboard-tour-complete', 'true')
    return null
  }
  const current = steps[step]
  if (!current) return null

  return (
    <aside className="guided-tour" aria-label="SyncBoard guided tour" aria-live="polite">
      <button
        className="tour-skip"
        onClick={() => {
          localStorage.setItem('syncboard-tour-complete', 'true')
          setStep(steps.length)
        }}
      >
        Skip tour
      </button>
      <span>{current.eyebrow}</span>
      <h2>{current.title}</h2>
      <p>{current.body}</p>
      <div className="tour-footer">
        <div className="tour-dots" aria-hidden="true">
          {steps.map((item, index) => (
            <span className={index === step ? 'active' : ''} key={item.title} />
          ))}
        </div>
        <button
          className="button button-primary"
          onClick={() => setStep((value) => value + 1)}
        >
          {step === steps.length - 1 ? 'Start planning' : 'Next'}
        </button>
      </div>
    </aside>
  )
}
