'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Coins,
  Activity,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { supabase, type ApiKey } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const router = useRouter()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  async function loadKeys() {
    setKeysLoading(true)
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at')
      .order('created_at', { ascending: false })
    if (!error && data) setKeys(data as ApiKey[])
    setKeysLoading(false)
  }

  useEffect(() => {
    if (user) loadKeys()
  }, [user])

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreating(true)
    setError(null)
    setRevealedKey(null)
    try {
      const { data, error } = await supabase.rpc('create_api_key', {
        p_name: newKeyName.trim(),
      })
      if (error) throw error
      if (data && data.length > 0) {
        setRevealedKey(data[0].key)
        setNewKeyName('')
        await loadKeys()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteKey(id: string) {
    const { error } = await supabase.from('api_keys').delete().eq('id', id)
    if (!error) {
      setKeys((prev) => prev.filter((k) => k.id !== id))
    }
  }

  function copyKey() {
    if (!revealedKey) return
    navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  const credits = profile?.credits ?? 0

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-[-10%] size-[36rem] rounded-full bg-primary/20 blur-[120px] animate-blob" />
        <div
          className="absolute -right-32 bottom-[-15%] size-[32rem] rounded-full bg-chart-2/15 blur-[120px] animate-blob"
          style={{ animationDelay: '6s' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_78%)]" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to chat
          </button>
          <p className="text-sm font-medium">{user.email}</p>
        </header>

        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="size-4" />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em]">
                Credits
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {credits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              1 credit = 1 second of thinking
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Key className="size-4" />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em]">
                API Keys
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{keys.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Keys you&apos;ve created
            </p>
          </div>
        </div>

        {/* Create key */}
        <section className="mb-8 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="size-4" />
            Create new API key
          </h2>
          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button type="submit" disabled={creating || !newKeyName.trim()} className="h-10 gap-1.5 rounded-xl">
              {creating ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
            </Button>
          </form>

          {error && (
            <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {revealedKey && (
            <div className="mt-4 animate-fade-up rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="mb-2 text-xs font-medium text-foreground">
                Copy your key now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-background/80 px-3 py-2 font-mono text-xs">
                  {revealedKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyKey}
                  aria-label="Copy key"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Keys list */}
        <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4" />
            Your API keys
          </h2>

          {keysLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No API keys yet. Create one above to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {k.key_prefix}…
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </p>
                    {k.last_used_at && (
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        Used {new Date(k.last_used_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteKey(k.id)}
                    aria-label={`Delete key ${k.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
