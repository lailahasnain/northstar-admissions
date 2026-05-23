import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      stageHistory: { orderBy: { changedAt: 'asc' } },
      applications: { include: { checklist: true } },
      conversations: {
        include: {
          messages: { orderBy: { sentAt: 'desc' }, take: 3 },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 3,
      },
      notes: { orderBy: { createdAt: 'desc' }, take: 5 },
      tasks: { where: { status: 'open' } },
      schoolsInquired: true,
      majorInterests: true,
      rankings: true,
    },
  })

  if (!lead) return new Response('Not found', { status: 404 })

  const prompt = `You are an admissions counselor assistant. Summarize this prospective student's situation in 3-4 sentences. Be specific, actionable, and direct. Focus on what the officer needs to know right now.

Student: ${lead.firstName} ${lead.lastName}
Current stage: ${lead.currentStage}
Email: ${lead.email}

Stage history: ${lead.stageHistory.map(s => `${s.stage} (${new Date(s.changedAt).toLocaleDateString()})`).join(' → ')}

Open tasks: ${lead.tasks.map(t => t.title).join(', ') || 'None'}

Competing schools: ${lead.schoolsInquired.map(s => s.schoolName).join(', ') || 'None'}

Major interests: ${lead.majorInterests.map(m => m.major).join(', ') || 'None'}

Recent notes: ${lead.notes.map(n => n.body.replace(/<[^>]*>/g, '')).join(' | ') || 'None'}

Missing checklist items: ${lead.applications.flatMap(a => a.checklist.filter(c => c.status === 'missing').map(c => c.itemType)).join(', ') || 'None'}

Recent conversation snippets: ${lead.conversations.flatMap(c => c.messages.slice(0, 1).map(m => m.body)).join(' | ') || 'None'}

Ranking signals: ${lead.rankings[0]?.reasonCodes.join(', ') || 'None'}`

  const stream = await anthropic.messages.stream({
   model: 'claude-sonnet-4-5',
    max_tokens: 300,
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