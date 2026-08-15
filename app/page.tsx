import { ChatView } from '@/components/chat/chat-view'

export default function Page() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient background wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-24 top-[-10%] size-[36rem] rounded-full bg-primary/20 blur-[120px] animate-blob" />
        <div
          className="absolute -right-32 bottom-[-15%] size-[32rem] rounded-full bg-chart-2/15 blur-[120px] animate-blob"
          style={{ animationDelay: '6s' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_78%)]" />
      </div>

      <ChatView />
    </main>
  )
}
