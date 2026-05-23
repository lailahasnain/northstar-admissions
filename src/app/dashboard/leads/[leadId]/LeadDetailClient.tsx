'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STAGE_COLORS: Record<string, string> = {
  Admitted: 'bg-green-100 text-green-800',
  Applied: 'bg-blue-100 text-blue-800',
  Inquiry: 'bg-yellow-100 text-yellow-800',
  Deposited: 'bg-purple-100 text-purple-800',
  Withdrawn: 'bg-red-100 text-red-800',
}

export default function LeadDetailClient({ lead, currentUser, allUsers }: any) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftType, setDraftType] = useState<'email' | 'sms'>('email')
  const [reassigning, setReassigning] = useState(false)
  const [newAssigneeId, setNewAssigneeId] = useState(lead.assigneeId)

  async function handleExplain() {
    setExplaining(true)
    setExplanation('')
    setDraft('')
    try {
      const res = await fetch(`/api/leads/${lead.id}/explain`)
      if (!res.ok) throw new Error('Failed')
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No reader')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setExplanation(prev => prev + decoder.decode(value))
      }
    } catch {
      setExplanation('⚠️ Unable to generate summary. Please try again.')
    } finally {
      setExplaining(false)
    }
  }

  async function handleDraft() {
    setDrafting(true)
    setDraft('')
    setExplanation('')
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: draftType }),
      })
      if (!res.ok) throw new Error('Failed')
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No reader')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setDraft(prev => prev + decoder.decode(value))
      }
    } catch {
      setDraft('⚠️ Unable to generate draft. Please try again.')
    } finally {
      setDrafting(false)
    }
  }

  async function handleReassign() {
    await fetch(`/api/leads/${lead.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: newAssigneeId }),
    })
    setReassigning(false)
    router.refresh()
  }

  const tabs = ['overview', 'conversations', 'applications', 'notes', 'activity']

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        ← Back to worklist
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {lead.firstName} {lead.lastName}
              </h1>
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[lead.currentStage]}`}>
                {lead.currentStage}
              </span>
            </div>
            <p className="text-gray-500">{lead.email} · {lead.phone}</p>
            <p className="text-sm text-gray-400 mt-1">
              Assigned to {lead.assignee.firstName} {lead.assignee.lastName}
            </p>
          </div>

          <div className="flex gap-2">
            {/* Reassign */}
            {currentUser.role === 'admin' && (
              <div className="flex items-center gap-2">
                {reassigning ? (
                  <>
                    <select
                      value={newAssigneeId}
                      onChange={e => setNewAssigneeId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                    >
                      {allUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                    <button onClick={handleReassign} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg">Save</button>
                    <button onClick={() => setReassigning(false)} className="text-sm text-gray-500">Cancel</button>
                  </>
                ) : (
                  <button
                    onClick={() => setReassigning(true)}
                    className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    Reassign
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 flex-wrap">
          <button
            onClick={handleExplain}
            disabled={explaining}
            className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {explaining ? '✨ Analyzing...' : '✨ Explain this lead'}
          </button>
          <div className="flex gap-2">
            <select
              value={draftType}
              onChange={e => setDraftType(e.target.value as 'email' | 'sms')}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {drafting ? '✍️ Drafting...' : '✍️ Draft outreach'}
            </button>
          </div>
        </div>

     {/* AI output */}
      {explanation && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
          <p className="text-xs font-medium text-purple-600 mb-2">✨ Lead Summary</p>
          {explanation}
        </div>
      )}
      {draft && (
        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
          <p className="text-xs font-medium text-indigo-600 mb-2">✍️ Draft Outreach</p>
          {draft}
        </div>
      )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Stage history */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Stage History</h3>
            <div className="space-y-2">
              {lead.stageHistory.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STAGE_COLORS[s.stage]}`}>{s.stage}</span>
                  <span className="text-gray-400">{new Date(s.changedAt).toLocaleDateString()}</span>
                  {s.reason && <span className="text-gray-500">· {s.reason}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Education</h3>
            {lead.education.map((e: any) => (
              <div key={e.id} className="text-sm">
                <p className="font-medium">{e.schoolName}</p>
                <p className="text-gray-500">GPA: {e.gpa ?? 'N/A'} · Grad: {e.graduationYear}</p>
              </div>
            ))}
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Open Tasks</h3>
            <div className="space-y-2">
              {lead.tasks.filter((t: any) => t.status === 'open').map((t: any) => (
                <div key={t.id} className="text-sm">
                  <p className="font-medium">{t.title}</p>
                  {t.dueAt && (
                    <p className={`text-xs ${new Date(t.dueAt) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                      Due: {new Date(t.dueAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
              {lead.tasks.filter((t: any) => t.status === 'open').length === 0 && (
                <p className="text-sm text-gray-400">No open tasks</p>
              )}
            </div>
          </div>

          {/* Interests */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Interests</h3>
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-1">Major interests</p>
              <div className="flex flex-wrap gap-1">
                {lead.majorInterests.map((m: any) => (
                  <span key={m.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m.major}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Also considering</p>
              <div className="flex flex-wrap gap-1">
                {lead.schoolsInquired.map((s: any) => (
                  <span key={s.id} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{s.schoolName}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="space-y-4">
          {lead.conversations.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-sm">{c.deliveryMethod}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {c.status}
                </span>
                <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="space-y-2">
                {c.messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-lg rounded-lg px-3 py-2 text-sm ${
                      m.direction === 'outbound'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {m.body}
                      <div className={`text-xs mt-1 ${m.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(m.sentAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="space-y-4">
          {lead.applications.map((a: any) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{a.programName}</p>
                  <p className="text-sm text-gray-500">{a.term} · {a.status}</p>
                </div>
                {a.decision && (
                  <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full">{a.decision}</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {a.checklist.map((c: any) => (
                  <div key={c.id} className={`text-xs rounded-lg p-2 ${
                    c.status === 'received' ? 'bg-green-50 text-green-700' :
                    c.status === 'missing' ? 'bg-red-50 text-red-700' :
                    c.status === 'waived' ? 'bg-gray-50 text-gray-500' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    <p className="font-medium">{c.itemType.replace(/_/g, ' ')}</p>
                    <p>{c.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-3">
          {lead.notes.map((n: any) => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{n.noteType.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-400">
                  {n.author.firstName} · {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: n.body }}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Recent Engagement</h3>
          <div className="space-y-2">
            {lead.engagementEvents.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{new Date(e.occurredAt).toLocaleDateString()}</span>
                <span className="text-gray-700">{e.eventType.replace(/_/g, ' ')}</span>
                {e.metadata?.page_url && (
                  <span className="text-gray-400 text-xs">{e.metadata.page_url}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}