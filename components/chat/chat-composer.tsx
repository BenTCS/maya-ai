'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (value: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(resize)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Respect IME composition for CJK input.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="rounded-3xl border border-border/70 bg-card/80 p-2 shadow-lg shadow-primary/5 backdrop-blur-xl transition-colors focus-within:border-primary/50">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            resize()
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message Verdant…"
          aria-label="Message input"
          className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.95rem] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200',
            canSend
              ? 'bg-primary text-primary-foreground shadow-md hover:scale-105 hover:brightness-105 active:scale-95'
              : 'cursor-not-allowed bg-muted text-muted-foreground',
          )}
        >
          <ArrowUp className="size-5" />
        </button>
      </div>
    </div>
  )
}
