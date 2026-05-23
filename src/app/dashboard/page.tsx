import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import WorklistClient from './WorklistClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  const rankingCount = await prisma.leadRanking.count()
  if (rankingCount === 0) {
    const { computeRankings } = await import('@/lib/ranking')
    await computeRankings()
  }

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
          applications: {
            include: {
              checklist: { where: { status: 'missing' } },
            },
          },
          schoolsInquired: true,
        },
      },
    },
  })

  const officers = await prisma.user.findMany({
    where: { role: 'counselor', active: true },
  })

  return (
    <WorklistClient
      rankings={JSON.parse(JSON.stringify(rankings))}
      userRole={user.role}
      officers={JSON.parse(JSON.stringify(officers))}
    />
  )
}