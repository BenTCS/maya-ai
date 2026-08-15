import { Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/mock-ai'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex w-full items-end gap-3 animate-fade-up',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-border/60',
          isUser
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground',
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </div>

      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed shadow-sm',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/60 bg-card text-card-foreground',
        )}
      >
        <span className="sr-only">
          {isUser ? 'You said: ' : 'Assistant said: '}
        </span>
        {message.content}
      </div>
    </div>
  )
}
