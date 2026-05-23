import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  const usersRaw = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'users.json'), 'utf-8')
  )
  const leadsRaw = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'leads.json'), 'utf-8')
  )

  // ─── Users ────────────────────────────────────────────
  console.log('👤 Seeding users...')
  const defaultPassword = await bcrypt.hash('password123', 10)

  for (const u of usersRaw) {
    await prisma.user.upsert({
      where: { externalId: u.user_id },
      update: {},
      create: {
        externalId: u.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        password: defaultPassword,
        role: u.role,
        active: u.active,
        createdAt: new Date(u.created_at),
        updatedAt: new Date(u.updated_at),
      },
    })
  }

  const allUsers = await prisma.user.findMany()
  const userMap = new Map(allUsers.map(u => [u.externalId, u.id]))
  console.log(`✅ ${allUsers.length} users ready`)

  // ─── Leads (batch) ────────────────────────────────────
  console.log('📋 Seeding leads...')

  const validLeads = leadsRaw.filter((l: any) => userMap.get(l.profile.assignee_id))

  await prisma.lead.createMany({
    data: validLeads.map((l: any) => ({
      externalId: l.lead_id,
      firstName: l.profile.first_name,
      lastName: l.profile.last_name,
      email: l.profile.email,
      phone: l.profile.phone ?? null,
      assigneeId: userMap.get(l.profile.assignee_id)!,
      currentStage: l.stage_history[l.stage_history.length - 1].stage,
      createdAt: new Date(l.profile.created_at),
      updatedAt: new Date(l.profile.updated_at),
    })),
    skipDuplicates: true,
  })

  const allLeads = await prisma.lead.findMany()
  const leadMap = new Map(allLeads.map(l => [l.externalId, l.id]))
  console.log(`✅ ${allLeads.length} leads ready`)

  // ─── Stage History (batch) ─────────────────────────────
  console.log('📊 Seeding stage history...')
  const stageData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.stage_history.map((s: any) => ({
      leadId,
      stage: s.stage,
      changedAt: new Date(s.changed_at),
      reason: s.reason ?? null,
    }))
  })
  await prisma.stageHistory.createMany({ data: stageData, skipDuplicates: true })
  console.log(`✅ ${stageData.length} stage history records`)

  // ─── Education (batch) ────────────────────────────────
  console.log('🎓 Seeding education...')
  const eduData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.education.map((e: any) => ({
      leadId,
      schoolName: e.school_name,
      schoolType: e.school_type,
      graduationYear: e.graduation_year ?? null,
      gpa: e.gpa ?? null,
      attendedFrom: e.attended_from ?? null,
      attendedTo: e.attended_to ?? null,
    }))
  })
  await prisma.education.createMany({ data: eduData, skipDuplicates: true })
  console.log(`✅ ${eduData.length} education records`)

  // ─── Major Interests (batch) ──────────────────────────
  const majorData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.major_interests.map((major: string) => ({ leadId, major }))
  })
  await prisma.majorInterest.createMany({ data: majorData, skipDuplicates: true })

  // ─── Schools Inquired (batch) ─────────────────────────
  const schoolData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.schools_inquired.map((schoolName: string) => ({ leadId, schoolName }))
  })
  await prisma.schoolInquired.createMany({ data: schoolData, skipDuplicates: true })

  // ─── Applications (batch) ─────────────────────────────
  console.log('📝 Seeding applications...')
  const appData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.applications.map((a: any) => ({
      externalId: a.application_id,
      leadId,
      programName: a.program_name,
      term: a.term ?? null,
      decision: a.decision ?? null,
      decisionDate: a.decision_date ? new Date(a.decision_date) : null,
      submittedDate: a.submitted_date ? new Date(a.submitted_date) : null,
      status: a.status,
    }))
  })
  await prisma.application.createMany({ data: appData, skipDuplicates: true })

  const allApps = await prisma.application.findMany()
  const appMap = new Map(allApps.map(a => [a.externalId, a.id]))

  // ─── Checklist Items (batch) ──────────────────────────
  const checklistData = leadsRaw.flatMap((l: any) =>
    l.applications.flatMap((a: any) => {
      const applicationId = appMap.get(a.application_id)
      if (!applicationId) return []
      return a.checklist.map((c: any) => ({
        externalId: c.item_id,
        applicationId,
        itemType: c.item_type,
        status: c.status,
        requestedAt: c.requested_at ? new Date(c.requested_at) : null,
        receivedAt: c.received_at ? new Date(c.received_at) : null,
        dueAt: c.due_at ? new Date(c.due_at) : null,
        notes: c.notes ?? null,
      }))
    })
  )
  await prisma.checklistItem.createMany({ data: checklistData, skipDuplicates: true })
  console.log(`✅ ${checklistData.length} checklist items`)

  // ─── Conversations (batch) ────────────────────────────
  console.log('💬 Seeding conversations...')
  const convoData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.conversations.map((c: any) => ({
      externalId: c.conversation_id,
      leadId,
      deliveryMethod: c.delivery_method,
      subject: c.subject ?? null,
      status: c.status,
      createdAt: new Date(c.created_at),
      lastActivityAt: new Date(c.last_activity_at),
    }))
  })
  await prisma.conversation.createMany({ data: convoData, skipDuplicates: true })

  const allConvos = await prisma.conversation.findMany()
  const convoMap = new Map(allConvos.map(c => [c.externalId, c.id]))

  // ─── Messages (batch) ─────────────────────────────────
  const messageData = leadsRaw.flatMap((l: any) =>
    l.conversations.flatMap((c: any) => {
      const conversationId = convoMap.get(c.conversation_id)
      if (!conversationId) return []
      return c.messages.map((m: any) => ({
        externalId: m.message_id,
        conversationId,
        direction: m.direction,
        senderUserId: m.sender_user_id ?? null,
        body: m.body,
        sentAt: new Date(m.sent_at),
      }))
    })
  )
  await prisma.message.createMany({ data: messageData, skipDuplicates: true })
  console.log(`✅ ${messageData.length} messages`)

  // ─── Notes (batch) ────────────────────────────────────
  console.log('📓 Seeding notes...')
  const noteData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.notes.flatMap((n: any) => {
      const authorId = userMap.get(n.author_id)
      if (!authorId) return []
      return [{
        externalId: n.note_id,
        leadId,
        authorId,
        body: n.body,
        noteType: n.note_type,
        createdAt: new Date(n.created_at),
        updatedAt: new Date(n.updated_at),
      }]
    })
  })
  await prisma.note.createMany({ data: noteData, skipDuplicates: true })
  console.log(`✅ ${noteData.length} notes`)

  // ─── Tasks (batch) ────────────────────────────────────
  console.log('✅ Seeding tasks...')
  const taskData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.tasks.flatMap((t: any) => {
      const assigneeId = userMap.get(t.assignee_id)
      if (!assigneeId) return []
      return [{
        externalId: t.task_id,
        leadId,
        assigneeId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        dueAt: t.due_at ? new Date(t.due_at) : null,
        completedAt: t.completed_at ? new Date(t.completed_at) : null,
        createdAt: new Date(t.created_at),
      }]
    })
  })
  await prisma.task.createMany({ data: taskData, skipDuplicates: true })
  console.log(`✅ ${taskData.length} tasks`)

  // ─── Engagement Events (batch) ────────────────────────
  console.log('📈 Seeding engagement events...')
  const engagementData = leadsRaw.flatMap((l: any) => {
    const leadId = leadMap.get(l.lead_id)
    if (!leadId) return []
    return l.engagement.map((e: any) => ({
      externalId: e.event_id,
      leadId,
      eventType: e.event_type,
      occurredAt: new Date(e.occurred_at),
      metadata: e.metadata ?? {},
    }))
  })
  await prisma.engagementEvent.createMany({ data: engagementData, skipDuplicates: true })
  console.log(`✅ ${engagementData.length} engagement events`)

  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })