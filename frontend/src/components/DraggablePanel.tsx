'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface Position {
  x: number
  y: number
}

interface DraggablePanelProps {
  title: string
  children: ReactNode
  onClose: () => void
  storageKey?: string
  defaultPosition?: Position
}

const DEFAULT_POSITION: Position = { x: 400, y: 100 }
const STORAGE_PREFIX = 'draggablePanel_'

export function DraggablePanel({
  title,
  children,
  onClose,
  storageKey = 'default',
  defaultPosition = DEFAULT_POSITION,
}: DraggablePanelProps) {
  const [position, setPosition] = useState<Position>(defaultPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef<Position>({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Restore position from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Position
        setPosition(parsed)
      }
    } catch {
      // Ignore errors
    }
  }, [storageKey])

  // Save position to localStorage when it changes
  const savePosition = (pos: Position) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(pos))
    } catch {
      // Ignore errors
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      setIsDragging(true)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newPos = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      }
      setPosition(newPos)
    }
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      savePosition(position)
    }
  }

  // Double-click to reset position
  const handleDoubleClick = () => {
    setPosition(defaultPosition)
    savePosition(defaultPosition)
  }

  // Global mouse event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, position])

  return (
    <div
      ref={panelRef}
      data-testid="draggable-panel"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: '360px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Title bar / drag handle */}
      <div
        data-testid="panel-drag-handle"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 500 }}>{title}</span>
        <button
          data-testid="panel-close-button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '16px',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
