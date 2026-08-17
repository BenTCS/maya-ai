'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Coins, LogIn, LayoutDashboard, LogOut } from 'lucide-react'
import {
  suggestions,
  ANON_MESSAGE_LIMIT,
  type Message,
} from '@/lib/mock-ai'
import { useAuth } from '@/components/auth/auth-provider'
import { supabase } from '@/lib/supabase/client'
import { MessageBubble } from './message-bubble'
import { ChatComposer } from './chat-composer'
import { TypingIndicator } from './typing-indicator'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Simulated thinking: a logged-out user gets short waits, a logged-in user
// gets longer "deeper" thinking so credits are actually deducted.
function thinkDurationMs(isAuthed: boolean): number {
  const base = isAuthed ? 1800 : 700
  return base + Math.floor(Math.random() * (isAuthed ? 2200 : 600))
}

export function ChatView() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isAuthed = !!user
  const anonMessageCount = messages.filter((m) => m.role === 'user').length
  const anonLimitReached = !isAuthed && anonMessageCount >= ANON_MESSAGE_LIMIT
  const credits = profile?.credits ?? 0
  const outOfCredits = isAuthed && credits <= 0

  const hasMessages = messages.length > 0

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  async function handleSend(text: string) {
    if (anonLimitReached || outOfCredits || thinking) return

    const userMessage: Message = { id: uid(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setThinking(true)

    const thinkMs = thinkDurationMs(isAuthed)
    const startedAt = performance.now()

    // Simulate the "thinking" delay; in a real deployment this is where the
    // model call would happen and the elapsed wall-clock would be billed.
    await new Promise((r) => setTimeout(r, thinkMs))

    // Generate a reply from the local mock-AI pool.
    const { generateReply } = await import('@/lib/mock-ai')
    const answer = generateReply(text)

    let creditsUsed: number | undefined
    if (isAuthed) {
      // Bill the user: 0.01 credits per 0.01s = 1 credit per second.
      const { error } = await supabase.rpc('deduct_credits', {
        p_thinking_ms: thinkMs,
      })
      if (!error) {
        creditsUsed = thinkMs / 1000
        await refreshProfile()
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content: answer,
        thinkingMs: thinkMs,
        creditsUsed,
      },
    ])
    setThinking(false)
    void startedAt
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

        <div className="flex items-center gap-3">
          {isAuthed && (
            <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
              <Coins className="size-3" />
              {credits.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
          )}
          {isAuthed ? (
            <>
              <a
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dashboard"
              >
                <LayoutDashboard className="size-4" />
              </a>
              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sign in"
            >
              <LogIn className="size-4" />
            </a>
          )}
        </div>
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
                {isAuthed
                  ? 'Ask me anything — your thinking time is billed in credits.'
                  : `Ask me anything. Guests get ${ANON_MESSAGE_LIMIT} free messages — sign in for more.`}
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

        {anonLimitReached && !thinking && (
          <div className="animate-fade-up rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 text-center">
            <p className="text-sm text-foreground">
              You&apos;ve used all {ANON_MESSAGE_LIMIT} guest messages.
            </p>
            <a
              href="/login"
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in for more messages and higher limits
            </a>
          </div>
        )}

        {outOfCredits && !thinking && (
          <div className="animate-fade-up rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-center">
            <p className="text-sm text-foreground">
              You&apos;re out of credits.
            </p>
            <a
              href="/dashboard"
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to dashboard
            </a>
          </div>
        )}
      </div>

      <div className="pb-5 pt-2">
        <ChatComposer
          onSend={handleSend}
          disabled={thinking || anonLimitReached || outOfCredits}
        />
        <p className="mt-2.5 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isAuthed
            ? '1 credit per second of thinking · 0.01 per 0.01s'
            : `Guest mode · ${ANON_MESSAGE_LIMIT - anonMessageCount} messages left`}
        </p>
      </div>
    </div>
  )
}
