import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraggablePanel } from '@/components/DraggablePanel'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('DraggablePanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('renders children content', () => {
    render(
      <DraggablePanel title="Test Panel" onClose={() => {}}>
        <div data-testid="panel-content">Content here</div>
      </DraggablePanel>
    )
    expect(screen.getByTestId('panel-content')).toBeInTheDocument()
    expect(screen.getByText('Content here')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(
      <DraggablePanel title="My Panel" onClose={() => {}}>
        <div>Content</div>
      </DraggablePanel>
    )
    expect(screen.getByText('My Panel')).toBeInTheDocument()
  })

  it('renders close button', () => {
    render(
      <DraggablePanel title="Test" onClose={() => {}}>
        <div>Content</div>
      </DraggablePanel>
    )
    expect(screen.getByTestId('panel-close-button')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <DraggablePanel title="Test" onClose={onClose}>
        <div>Content</div>
      </DraggablePanel>
    )
    fireEvent.click(screen.getByTestId('panel-close-button'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has draggable panel element', () => {
    render(
      <DraggablePanel title="Test" onClose={() => {}}>
        <div>Content</div>
      </DraggablePanel>
    )
    expect(screen.getByTestId('draggable-panel')).toBeInTheDocument()
  })

  it('has drag handle in title bar', () => {
    render(
      <DraggablePanel title="Test" onClose={() => {}}>
        <div>Content</div>
      </DraggablePanel>
    )
    expect(screen.getByTestId('panel-drag-handle')).toBeInTheDocument()
  })
})
