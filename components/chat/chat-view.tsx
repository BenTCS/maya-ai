'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { suggestions, type Message } from '@/lib/mock-ai'
import { MessageBubble } from './message-bubble'
import { ChatComposer } from './chat-composer'
import { TypingIndicator } from './typing-indicator'

// Where your own server.py is running. Change this if you deploy it
// somewhere other than localhost.
const API_URL = 'http://localhost:8000/chat'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  async function handleSend(text: string) {
    const userMessage: Message = { id: uid(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setThinking(true)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`)
      }

      const data: { answer: string; sources?: string[] } = await res.json()

      const reply = data.sources?.length
        ? `${data.answer}\n\nSources: ${data.sources.join(', ')}`
        : data.answer

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: reply },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            "Couldn't reach the local AI server. Make sure server.py is running (python server.py) at localhost:8000.",
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Verdant</p>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              AI Assistant
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Online
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-6 overflow-y-auto scroll-smooth py-4"
      >
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center gap-8 text-center animate-fade-in">
            <div className="relative flex size-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary/25 blur-2xl animate-blob" />
              <div className="relative flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Sparkles className="size-7" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-balance text-2xl font-semibold">
                How can I help you today?
              </h1>
              <p className="text-pretty text-sm text-muted-foreground">
                Ask me anything about your documents — answered by your own
                local model.
              </p>
            </div>
            <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  style={{ animationDelay: `${i * 0.07}s` }}
                  className="animate-fade-up rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-left text-sm text-card-foreground shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {thinking && (
          <div className="flex items-end gap-3 animate-fade-up">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-1 ring-border/60">
              <Sparkles className="size-4" />
            </div>
            <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3.5 shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <div className="pb-5 pt-2">
        <ChatComposer onSend={handleSend} disabled={thinking} />
        <p className="mt-2.5 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
          Powered by your own local model · Not a demo
        </p>
      </div>
    </div>
  )
}
