import { prisma } from './db'

// ─── Stage weights (higher = more urgent) ─────────────────────
const STAGE_WEIGHTS: Record<string, number> = {
  Admitted: 100,
  Applied: 60,
  Inquiry: 30,
  Deposited: 0,
  Withdrawn: 0,
}

// ─── Signal weights ────────────────────────────────────────────
const SIGNALS = {
  unanswered_inbound: 40,
  overdue_task: 30,
  missing_checklist_item: 20,
  competing_school: 15,
  days_since_contact: 10, // per 7 days of silence, up to 30pts
  recent_engagement: 10,
}

type ReasonCode =
  | 'unanswered_inbound'
  | 'overdue_task'
  | 'missing_checklist_item'
  | 'competing_school'
  | 'gone_cold'
  | 'recent_engagement'

interface RankResult {
  leadId: string
  assigneeId: string
  score: number
  reasonCodes: ReasonCode[]
}

export async function computeRankings(): Promise<void> {
  const now = new Date()

  // Pull all active leads (exclude terminal stages)
  const leads = await prisma.lead.findMany({
    where: {
      currentStage: { notIn: ['Deposited', 'Withdrawn'] },
    },
    include: {
      conversations: {
        include: { messages: { orderBy: { sentAt: 'desc' } } },
        orderBy: { lastActivityAt: 'desc' },
      },
      tasks: true,
      applications: {
        include: { checklist: true },
      },
      schoolsInquired: true,
      engagementEvents: {
        orderBy: { occurredAt: 'desc' },
        take: 5,
      },
    },
  })

  const results: RankResult[] = []

  for (const lead of leads) {
    const reasonCodes: ReasonCode[] = []
    let signalScore = 0

    // 1. Stage base score
    const stageBase = STAGE_WEIGHTS[lead.currentStage] ?? 0

    // 2. Unanswered inbound message (open convo, last message is inbound)
    const hasUnansweredInbound = lead.conversations.some(c => {
      if (c.status !== 'open') return false
      const lastMsg = c.messages[0]
      return lastMsg && lastMsg.direction === 'inbound'
    })
    if (hasUnansweredInbound) {
      signalScore += SIGNALS.unanswered_inbound
      reasonCodes.push('unanswered_inbound')
    }

    // 3. Overdue open tasks
    const hasOverdueTask = lead.tasks.some(
      t => t.status === 'open' && t.dueAt && t.dueAt < now
    )
    if (hasOverdueTask) {
      signalScore += SIGNALS.overdue_task
      reasonCodes.push('overdue_task')
    }

    // 4. Missing checklist items
    const hasMissingChecklist = lead.applications.some(a =>
      a.checklist.some(c => c.status === 'missing')
    )
    if (hasMissingChecklist) {
      signalScore += SIGNALS.missing_checklist_item
      reasonCodes.push('missing_checklist_item')
    }

    // 5. Competing schools (flight risk)
    if (lead.schoolsInquired.length > 1) {
      signalScore += SIGNALS.competing_school
      reasonCodes.push('competing_school')
    }

    // 6. Days since last contact (silence penalty)
    const lastConvo = lead.conversations[0]
    if (lastConvo) {
      const daysSince = Math.floor(
        (now.getTime() - lastConvo.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSince >= 7) {
        const silencePenalty = Math.min(Math.floor(daysSince / 7) * SIGNALS.days_since_contact, 30)
        signalScore += silencePenalty
        reasonCodes.push('gone_cold')
      }
    } else {
      // Never contacted — treat as maximum silence
      signalScore += 30
      reasonCodes.push('gone_cold')
    }

    // 7. Recent engagement (student is active on website)
    const recentEngagement = lead.engagementEvents.some(e => {
      const daysSince = Math.floor(
        (now.getTime() - e.occurredAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysSince <= 3
    })
    if (recentEngagement) {
      signalScore += SIGNALS.recent_engagement
      reasonCodes.push('recent_engagement')
    }

    // Final score = stage base + signals
    const score = stageBase + signalScore

    results.push({
      leadId: lead.id,
      assigneeId: lead.assigneeId,
      score,
      reasonCodes,
    })
  }

  // ─── Write rankings to DB ──────────────────────────────────
  // Delete all existing rankings and replace
  await prisma.leadRanking.deleteMany()

  await prisma.leadRanking.createMany({
    data: results.map(r => ({
      leadId: r.leadId,
      assigneeId: r.assigneeId,
      score: r.score,
      reasonCodes: r.reasonCodes,
      rankedAt: now,
    })),
  })

  // Log the re-rank event
  await prisma.auditLog.create({
    data: {
      action: 'reranked',
      metadata: { leadCount: results.length, triggeredAt: now.toISOString() },
    },
  })

  console.log(`✅ Ranked ${results.length} leads`)
}