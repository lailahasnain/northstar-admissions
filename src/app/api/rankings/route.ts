import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { computeRankings } from '@/lib/ranking'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await computeRankings()
  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

  // Admins see all rankings, counselors see only their own
  const rankings = await prisma.leadRanking.findMany({
    where: user.role === 'admin' ? {} : { assigneeId: user.id },
    orderBy: { score: 'desc' },
    include: {
      lead: {
        include: {
          assignee: true,
          tasks: { where: { status: 'open' } },
          conversations: {
            orderBy: { lastActivityAt: 'desc' },
            take: 1,
          },
          applications: true,
        },
      },
    },
  })

  return NextResponse.json(rankings)
}