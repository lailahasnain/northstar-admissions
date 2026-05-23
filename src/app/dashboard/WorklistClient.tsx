'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const REASON_LABELS: Record<string, string> = {
  unanswered_inbound: '💬 Unanswered message',
  overdue_task: '⚠️ Overdue task',
  missing_checklist_item: '📋 Missing documents',
  competing_school: '🏫 Considering other schools',
  gone_cold: '❄️ Gone cold',
  recent_engagement: '🔥 Recently active',
}

const STAGE_COLORS: Record<string, string> = {
  Admitted: 'bg-green-100 text-green-800',
  Applied: 'bg-blue-100 text-blue-800',
  Inquiry: 'bg-yellow-100 text-yellow-800',
  Deposited: 'bg-purple-100 text-purple-800',
  Withdrawn: 'bg-red-100 text-red-800',
}

interface Officer {
  id: string
  firstName: string
  lastName: string
}

interface Props {
  rankings: any[]
  userRole: string
  officers?: Officer[]
}

export default function WorklistClient({ rankings, userRole, officers }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [officerFilter, setOfficerFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rank')
  const [reranking, setReranking] = useState(false)

  const filtered = rankings
    .filter(r => {
      const lead = r.lead
      const name = `${lead.firstName} ${lead.lastName}`.toLowerCase()
      const matchesSearch = name.includes(search.toLowerCase()) || lead.email.includes(search.toLowerCase())
      const matchesStage = stageFilter === 'all' || lead.currentStage === stageFilter
      const matchesOfficer = officerFilter === 'all' || lead.assigneeId === officerFilter
      return matchesSearch && matchesStage && matchesOfficer
    })
    .sort((a, b) => {
      if (sortBy === 'rank') return b.score - a.score
      if (sortBy === 'deadline') {
        const aTask = a.lead.tasks[0]?.dueAt ?? '9999'
        const bTask = b.lead.tasks[0]?.dueAt ?? '9999'
        return aTask < bTask ? -1 : 1
      }
      if (sortBy === 'last_contact') {
        const aConvo = a.lead.conversations[0]?.lastActivityAt ?? '0'
        const bConvo = b.lead.conversations[0]?.lastActivityAt ?? '0'
        return aConvo < bConvo ? -1 : 1
      }
      return 0
    })

  async function handleRerank() {
    setReranking(true)
    await fetch('/api/rankings', { method: 'POST' })
    router.refresh()
    setReranking(false)
  }

  async function handleContacted(leadId: string) {
    await fetch(`/api/leads/${leadId}/contacted`, { method: 'POST' })
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Today's Worklist</h2>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} leads to action</p>
        </div>
        <button
          onClick={handleRerank}
          disabled={reranking}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {reranking ? 'Re-ranking...' : '↻ Re-rank'}
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All stages</option>
          <option value="Admitted">Admitted</option>
          <option value="Applied">Applied</option>
          <option value="Inquiry">Inquiry</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="rank">Sort by rank</option>
          <option value="deadline">Sort by deadline</option>
          <option value="last_contact">Sort by last contact</option>
        </select>
        {userRole === 'admin' && officers && (
          <select
            value={officerFilter}
            onChange={e => setOfficerFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All officers</option>
            {officers.map(o => (
              <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((r, index) => {
          const lead = r.lead
          const lastConvo = lead.conversations[0]
          const missingDocs = lead.applications.flatMap((a: any) => a.checklist).length
          const overdueTasks = lead.tasks.filter((t: any) => t.dueAt && new Date(t.dueAt) < new Date()).length

          return (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-2xl font-bold text-gray-300 w-8 text-center mt-1">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {lead.firstName} {lead.lastName}
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[lead.currentStage]}`}>
                        {lead.currentStage}
                      </span>
                      {userRole === 'admin' && (
                        <span className="text-xs text-gray-400">
                          → {lead.assignee.firstName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {lead.email}
                      {lastConvo && (
                        <span className="ml-3 text-gray-400">
                          Last contact: {new Date(lastConvo.lastActivityAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {r.reasonCodes.map((code: string) => (
                        <span key={code} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {REASON_LABELS[code] ?? code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right text-xs text-gray-400 mr-2">
                    {missingDocs > 0 && <div>{missingDocs} missing docs</div>}
                    {overdueTasks > 0 && <div>{overdueTasks} overdue tasks</div>}
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                    className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleContacted(lead.id)}
                    className="text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5"
                  >
                    ✓ Contacted
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}