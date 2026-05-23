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
  const { leadId } = await params

  await prisma.leadRanking.deleteMany({
    where: { leadId },
  })

  await prisma.auditLog.create({
    data: {
      leadId,
      userId: user.id,
      action: 'contacted',
      metadata: { contactedAt: new Date().toISOString() },
    },
  })

  return NextResponse.json({ success: true })
}