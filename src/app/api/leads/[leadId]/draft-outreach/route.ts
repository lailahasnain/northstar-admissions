import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { leadId } = await params
  const { type } = await req.json()

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignee: true,
      applications: { include: { checklist: true } },
      conversations: {
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 2 } },
        orderBy: { lastActivityAt: 'desc' },
        take: 2,
      },
      notes: { orderBy: { createdAt: 'desc' }, take: 3 },
      tasks: { where: { status: 'open' } },
      schoolsInquired: true,
      majorInterests: true,
    },
  })

  if (!lead) return new Response('Not found', { status: 404 })

  const missingDocs = lead.applications
    .flatMap(a => a.checklist.filter(c => c.status === 'missing').map(c => c.itemType))

  const recentMessages = lead.conversations
    .flatMap(c => c.messages.slice(0, 1).map(m => `${m.direction}: ${m.body}`))

  const prompt = type === 'email'
    ? `Write a personalized admissions follow-up email from ${lead.assignee.firstName} ${lead.assignee.lastName} to ${lead.firstName} ${lead.lastName}.

Context:
- Current stage: ${lead.currentStage}
- Interested in: ${lead.majorInterests.map(m => m.major).join(', ')}
- Also considering: ${lead.schoolsInquired.map(s => s.schoolName).join(', ') || 'no other schools'}
- Missing documents: ${missingDocs.join(', ') || 'none'}
- Open tasks: ${lead.tasks.map(t => t.title).join(', ') || 'none'}
- Recent conversation: ${recentMessages.join(' | ') || 'no recent contact'}

Write a warm, professional, concise email (3-4 sentences). Include a clear call to action. Do not use placeholders. Sign off as ${lead.assignee.firstName}.`
    : `Write a short SMS (under 160 characters) from ${lead.assignee.firstName} to ${lead.firstName} ${lead.lastName}.

Context:
- Stage: ${lead.currentStage}
- Missing docs: ${missingDocs.join(', ') || 'none'}
- Recent context: ${recentMessages[0] || 'no recent contact'}

Be friendly and direct. Include one clear action.`

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}