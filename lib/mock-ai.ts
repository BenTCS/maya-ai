export type Role = 'user' | 'assistant'

export type Message = {
  id: string
  role: Role
  content: string
}

const replies = [
  "That's a great question. Here's how I'd think about it: break the problem into smaller pieces, tackle the clearest one first, and let the rest fall into place. Want me to go deeper on any part?",
  "Absolutely — I can help with that. Give me a little more context and I'll tailor the answer to exactly what you need.",
  "Here's a quick take: the simplest solution that works is usually the right place to start. We can always add sophistication once the fundamentals feel solid.",
  "Interesting! There are a few directions we could go here. My instinct is to start with the option that's easiest to reverse, so you keep your choices open.",
  "Good thinking. I'd summarize it like this — clarity beats cleverness, small steps beat big leaps, and momentum beats perfection. Shall we map out the next step together?",
  "I love this line of thinking. Let me lay out the trade-offs so the decision feels obvious once you see them side by side.",
]

export function generateReply(prompt: string): string {
  const trimmed = prompt.trim().toLowerCase()
  if (/^(hi|hey|hello|yo|sup)\b/.test(trimmed)) {
    return "Hey there! I'm Verdant, your calm little AI companion. What's on your mind today?"
  }
  if (trimmed.includes('thank')) {
    return "You're very welcome — happy to help anytime. Anything else I can do for you?"
  }
  if (trimmed.endsWith('?')) {
    return replies[Math.floor(Math.random() * 3)]
  }
  return replies[Math.floor(Math.random() * replies.length)]
}

export const suggestions = [
  'Explain a hard idea simply',
  'Draft a friendly email',
  'Give me a creative name',
  'Plan my weekend',
]
