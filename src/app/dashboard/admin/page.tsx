import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'admin') redirect('/dashboard')

  const officers = await prisma.user.findMany({
    where: { role: 'counselor', active: true },
  })

  const stats = await Promise.all(
    officers.map(async (officer) => {
      const total = await prisma.lead.count({
        where: { assigneeId: officer.id, currentStage: { notIn: ['Withdrawn'] } },
      })
      const admitted = await prisma.lead.count({
        where: { assigneeId: officer.id, currentStage: 'Admitted' },
      })
      const deposited = await prisma.lead.count({
        where: { assigneeId: officer.id, currentStage: 'Deposited' },
      })
      const applied = await prisma.lead.count({
        where: { assigneeId: officer.id, currentStage: 'Applied' },
      })
      const inquiry = await prisma.lead.count({
        where: { assigneeId: officer.id, currentStage: 'Inquiry' },
      })
      const overdueTasks = await prisma.task.count({
        where: {
          assigneeId: officer.id,
          status: 'open',
          dueAt: { lt: new Date() },
        },
      })
      const unanswered = await prisma.conversation.count({
        where: {
          lead: { assigneeId: officer.id },
          status: 'open',
        },
      })
      const contactedToday = await prisma.auditLog.count({
        where: {
          userId: officer.id,
          action: 'contacted',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      })

      return {
        officer,
        total,
        admitted,
        deposited,
        applied,
        inquiry,
        overdueTasks,
        unanswered,
        contactedToday,
      }
    })
  )

  const recentActivity = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: true,
      lead: true,
    },
  })

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>

      {/* Officer cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ officer, total, admitted, deposited, applied, inquiry, overdueTasks, unanswered, contactedToday }) => (
          <div key={officer.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{officer.firstName} {officer.lastName}</h3>
                <p className="text-xs text-gray-400">{officer.email}</p>
              </div>
              <div className="text-2xl font-bold text-gray-900">{total}</div>
            </div>

            {/* Stage breakdown */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Admitted</span>
                <span className="font-medium">{admitted}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${total ? (admitted / total) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-600">Applied</span>
                <span className="font-medium">{applied}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${total ? (applied / total) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-yellow-600">Inquiry</span>
                <span className="font-medium">{inquiry}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${total ? (inquiry / total) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-600">Deposited</span>
                <span className="font-medium">{deposited}</span>
              </div>
            </div>

            {/* Alerts */}
            <div className="border-t border-gray-100 pt-3 space-y-1">
              {overdueTasks > 0 && (
                <p className="text-xs text-red-500">⚠️ {overdueTasks} overdue tasks</p>
              )}
              {unanswered > 0 && (
                <p className="text-xs text-orange-500">💬 {unanswered} open conversations</p>
              )}
              <p className="text-xs text-green-600">✓ {contactedToday} contacted today</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {recentActivity.map((log) => (
            <div key={log.id} className="flex items-center gap-3 text-sm py-1 border-b border-gray-50">
              <span className="text-gray-400 text-xs w-32 shrink-0">
                {new Date(log.createdAt).toLocaleString()}
              </span>
              <span className="text-gray-600 font-medium w-24 shrink-0">
                {log.user?.firstName ?? 'System'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                log.action === 'contacted' ? 'bg-green-100 text-green-700' :
                log.action === 'reassigned' ? 'bg-blue-100 text-blue-700' :
                log.action === 'reranked' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {log.action}
              </span>
              {log.lead && (
                <span className="text-gray-500">
                  {log.lead.firstName} {log.lead.lastName}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}