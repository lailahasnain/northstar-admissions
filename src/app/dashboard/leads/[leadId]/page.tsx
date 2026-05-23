import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import LeadDetailClient from './LeadDetailClient'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  const { leadId } = await params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignee: true,
      stageHistory: { orderBy: { changedAt: 'asc' } },
      education: true,
      applications: {
        include: { checklist: true },
      },
      majorInterests: true,
      schoolsInquired: true,
      conversations: {
        include: {
          messages: { orderBy: { sentAt: 'asc' } },
        },
        orderBy: { lastActivityAt: 'desc' },
      },
      notes: {
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      },
      tasks: { orderBy: { dueAt: 'asc' } },
      engagementEvents: { orderBy: { occurredAt: 'desc' }, take: 20 },
      rankings: true,
    },
  })

  if (!lead) notFound()

  if (user.role !== 'admin' && lead.assigneeId !== user.id) redirect('/dashboard')

  const allUsers = await prisma.user.findMany({ where: { active: true } })

  return (
    <LeadDetailClient
      lead={JSON.parse(JSON.stringify(lead))}
      currentUser={user}
      allUsers={JSON.parse(JSON.stringify(allUsers))}
    />
  )
}