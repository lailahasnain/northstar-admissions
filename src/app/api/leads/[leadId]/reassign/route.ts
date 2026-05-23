import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { leadId } = await params
  const { assigneeId } = await req.json()

  const oldLead = await prisma.lead.findUnique({ where: { id: leadId } })

  await prisma.lead.update({
    where: { id: leadId },
    data: { assigneeId },
  })

  await prisma.leadRanking.updateMany({
    where: { leadId },
    data: { assigneeId },
  })

  await prisma.auditLog.create({
    data: {
      leadId,
      userId: user.id,
      action: 'reassigned',
      metadata: {
        fromAssigneeId: oldLead?.assigneeId,
        toAssigneeId: assigneeId,
      },
    },
  })

  return NextResponse.json({ success: true })
}