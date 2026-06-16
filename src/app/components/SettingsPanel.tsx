'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

type Section = 'account' | 'notifications' | 'privacy' | 'ignored' | 'blocked' | 'about'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  userId: string
  initialProfile: { name: string | null; handle: string | null; avatar_url: string | null } | null
}

interface NotifPrefs {
  notify_followers: boolean
  notify_likes: boolean
  notify_bookmarks: boolean
  notify_comments: boolean
  email_digest: boolean
  email_digest_freq: string
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={checked}
      style={{
        flexShrink: 0,
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        background: checked ? '#4aad4e' : 'rgba(0,0,0,0.1)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#faf8f4',
          transition: 'left 0.18s',
        }}
      />
    </button>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <span className="font-body" style={{ fontSize: '14px', color: '#33261a' }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body" style={{
      fontSize: '11px', color: '#6b5d4f', letterSpacing: '0.06em',
      textTransform: 'uppercase', marginBottom: '6px',
    }}>
      {children}
    </p>
  )
}

function InlineEdit({
  label,
  value,
  onSave,
  type = 'text',
  note,
}: {
  label: string
  value: string
  onSave: (val: string) => Promise<void>
  type?: string
  note?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function commit() {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
            className="font-body"
            style={{
              flex: 1, background: 'rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.12)', borderRadius: '7px',
              color: '#33261a', fontSize: '14px', padding: '7px 10px', outline: 'none',
            }}
          />
          <button
            onClick={commit}
            disabled={saving}
            className="font-body"
            style={{
              background: '#33261a', color: '#f5f0e8', border: 'none', borderRadius: '7px',
              fontSize: '13px', fontWeight: 600, padding: '7px 14px',
              cursor: 'pointer', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(value) }}
            className="font-body"
            style={{ background: 'none', border: 'none', color: '#6b5d4f', fontSize: '13px', cursor: 'pointer', padding: '7px 4px' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="font-body" style={{ fontSize: '14px', color: '#33261a', flex: 1, wordBreak: 'break-all' }}>
            {value || <span style={{ color: '#6b5d4f' }}>—</span>}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="font-body"
            style={{
              background: 'none', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '6px',
              color: '#6b5d4f', fontSize: '12px', padding: '4px 10px', cursor: 'pointer', flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#33261a'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b5d4f'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)' }}
          >
            Edit
          </button>
        </div>
      )}
      {note && (
        <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', marginTop: '6px', lineHeight: '1.4' }}>
          {note}
        </p>
      )}
    </div>
  )
}

// ── Section: Account ──────────────────────────────────────────────────────────

function AccountSection({
  userId,
  initialName,
  onSignOut,
  onDeleteRequest,
}: {
  userId: string
  initialName: string | null
  onSignOut: () => void
  onDeleteRequest: () => void
}) {
  const toast = useToast()
  const [displayName, setDisplayName] = useState(initialName ?? '')
  const [email, setEmail] = useState('')
  const [isEmailUser, setIsEmailUser] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      setIsEmailUser(user.identities?.some(i => i.provider === 'email') ?? false)
    })
  }, [])

  const saveName = async (val: string) => {
    setDisplayName(val)
    const supabase = createClient()
    await supabase.from('profiles').update({ name: val }).eq('id', userId)
    toast('Name saved')
  }

  const saveEmail = async (val: string) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: val })
    if (!error) { setEmail(val); toast('Confirmation sent to your new email') }
  }

  const changePassword = async () => {
    if (pwNew !== pwConfirm) { setPwMsg({ text: 'Passwords do not match.', ok: false }); return }
    if (pwNew.length < 6) { setPwMsg({ text: 'Must be at least 6 characters.', ok: false }); return }
    setPwSaving(true)
    setPwMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwSaving(false)
    if (error) { setPwMsg({ text: error.message, ok: false }); return }
    setPwNew('')
    setPwConfirm('')
    setPwMsg(null)
    toast('Password updated')
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '7px',
    color: '#33261a',
    fontSize: '14px',
    padding: '8px 10px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div>
      <InlineEdit label="Display name" value={displayName} onSave={saveName} />
      <InlineEdit
        label="Email address"
        value={email}
        onSave={saveEmail}
        type="email"
        note="A confirmation link will be sent to the new address."
      />

      {isEmailUser && (
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <FieldLabel>Change password</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="password"
              placeholder="New password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              className="font-body"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') changePassword() }}
              className="font-body"
              style={inputStyle}
            />
            {pwMsg && (
              <p className="font-body" style={{ fontSize: '12px', color: pwMsg.ok ? '#4aad4e' : '#e05555' }}>
                {pwMsg.text}
              </p>
            )}
            <button
              onClick={changePassword}
              disabled={pwSaving || !pwNew}
              className="font-body"
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(0,0,0,0.08)',
                border: 'none', borderRadius: '7px',
                color: '#33261a', fontSize: '13px', fontWeight: 500,
                padding: '8px 16px', cursor: 'pointer',
                opacity: pwSaving || !pwNew ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {pwSaving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </div>
      )}

      {/* Log out */}
      <div style={{ marginTop: '28px' }}>
        <button
          onClick={onSignOut}
          className="font-body"
          style={{
            background: 'none',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: '8px',
            color: '#6b5d4f', fontSize: '14px',
            padding: '9px 20px', cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#33261a'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b5d4f'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
        >
          Log out
        </button>
      </div>

      {/* Delete account — visually separated and muted */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        <button
          onClick={onDeleteRequest}
          className="font-body"
          style={{
            background: 'none', border: 'none',
            color: '#6b5d4f', fontSize: '13px',
            padding: 0, cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e05555')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
        >
          Delete account
        </button>
      </div>
    </div>
  )
}

// ── Section: Notifications ────────────────────────────────────────────────────

function NotificationsSection({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<NotifPrefs>({
    notify_followers: true,
    notify_likes: true,
    notify_bookmarks: true,
    notify_comments: true,
    email_digest: false,
    email_digest_freq: 'weekly',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('notify_followers, notify_likes, notify_bookmarks, notify_comments, email_opted_in, email_digest_freq')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setPrefs({
          notify_followers: data.notify_followers ?? true,
          notify_likes: data.notify_likes ?? true,
          notify_bookmarks: data.notify_bookmarks ?? true,
          notify_comments: data.notify_comments ?? true,
          email_digest: data.email_opted_in ?? false,
          email_digest_freq: data.email_digest_freq ?? 'weekly',
        })
      })
  }, [userId])

  const save = (patch: Record<string, boolean | string>) => {
    const supabase = createClient()
    supabase.from('profiles').update(patch).eq('id', userId).then(() => {})
  }

  const toggle = (key: keyof NotifPrefs, dbKey: string) => {
    const next = !prefs[key]
    setPrefs(p => ({ ...p, [key]: next }))
    save({ [dbKey]: next })
  }

  const setFreq = (freq: string) => {
    setPrefs(p => ({ ...p, email_digest_freq: freq }))
    save({ email_digest_freq: freq })
  }

  const subLabel: React.CSSProperties = {
    fontSize: '11px', color: '#6b5d4f', letterSpacing: '0.06em',
    textTransform: 'uppercase', marginBottom: '4px', marginTop: '0',
  }

  return (
    <div>
      <p className="font-body" style={subLabel}>In-app</p>
      <ToggleRow label="New followers" checked={prefs.notify_followers} onChange={() => toggle('notify_followers', 'notify_followers')} />
      <ToggleRow label="Likes on my recommendations" checked={prefs.notify_likes} onChange={() => toggle('notify_likes', 'notify_likes')} />
      <ToggleRow label="Bookmarks of my recommendations" checked={prefs.notify_bookmarks} onChange={() => toggle('notify_bookmarks', 'notify_bookmarks')} />
      <ToggleRow label="Comments on my recommendations" checked={prefs.notify_comments} onChange={() => toggle('notify_comments', 'notify_comments')} />

      <div style={{ marginTop: '24px' }}>
        <p className="font-body" style={subLabel}>Email</p>
        <ToggleRow label="Email digest" checked={prefs.email_digest} onChange={() => toggle('email_digest', 'email_opted_in')} />
        {prefs.email_digest && (
          <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
            {(['weekly', 'monthly'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                className="font-body"
                style={{
                  background: prefs.email_digest_freq === f ? 'rgba(0,0,0,0.1)' : 'none',
                  border: `1px solid ${prefs.email_digest_freq === f ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: '7px',
                  color: prefs.email_digest_freq === f ? '#33261a' : '#6b5d4f',
                  fontSize: '13px', padding: '6px 16px', cursor: 'pointer',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section: Privacy ──────────────────────────────────────────────────────────
// Requires: `bookmarks_private boolean default false` on the profiles table

function PrivacySection({ userId }: { userId: string }) {
  const [profilePrivate, setProfilePrivate] = useState(false)
  const [bookmarksPrivate, setBookmarksPrivate] = useState(false)
  const [collectionsPrivate, setCollectionsPrivate] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('profile_private, bookmarks_private, collections_private')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setProfilePrivate(data.profile_private ?? false)
        setBookmarksPrivate(data.bookmarks_private ?? false)
        setCollectionsPrivate(data.collections_private ?? false)
      })
  }, [userId])

  const toggleProfilePrivate = () => {
    const next = !profilePrivate
    setProfilePrivate(next)
    const supabase = createClient()
    supabase.from('profiles').update({ profile_private: next }).eq('id', userId).then(() => {})
  }

  const toggleBookmarksPrivate = () => {
    const next = !bookmarksPrivate
    setBookmarksPrivate(next)
    const supabase = createClient()
    supabase.from('profiles').update({ bookmarks_private: next }).eq('id', userId).then(() => {})
  }

  const toggleCollectionsPrivate = () => {
    const next = !collectionsPrivate
    setCollectionsPrivate(next)
    const supabase = createClient()
    supabase.from('profiles').update({ collections_private: next }).eq('id', userId).then(() => {})
  }

  return (
    <div>
      <ToggleRow
        label="Private profile"
        checked={profilePrivate}
        onChange={toggleProfilePrivate}
      />
      <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', lineHeight: '1.55', padding: '6px 0 18px' }}>
        {profilePrivate
          ? 'Only people who follow you can see your recommendations and bookmarks.'
          : 'Your profile is public. Anyone can discover your recommendations.'}
      </p>
      <ToggleRow
        label="Private bookmarks"
        checked={bookmarksPrivate}
        onChange={toggleBookmarksPrivate}
      />
      <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', lineHeight: '1.55', padding: '6px 0 18px' }}>
        {bookmarksPrivate
          ? 'Your Bookmarked tab is hidden from other users.'
          : 'Your Bookmarked tab is visible on your profile.'}
      </p>
      <ToggleRow
        label="Make all collections private"
        checked={collectionsPrivate}
        onChange={toggleCollectionsPrivate}
      />
      <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', lineHeight: '1.55', padding: '6px 0 0' }}>
        {collectionsPrivate
          ? 'Your Collections tab is hidden from all other users, regardless of individual collection settings.'
          : 'Collection visibility follows each collection\'s own privacy setting.'}
      </p>
    </div>
  )
}

// ── Section: Ignored Users ────────────────────────────────────────────────────

interface IgnoredUser {
  ignored_user_id: string
  name: string | null
  handle: string | null
}

function IgnoredUsersSection({ userId }: { userId: string }) {
  const [ignored, setIgnored] = useState<IgnoredUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('user_ignores')
      .select('ignored_user_id, profiles:ignored_user_id(name, handle)')
      .eq('user_id', userId)
      .then(({ data }) => {
        const rows: IgnoredUser[] = (data ?? []).map((r: { ignored_user_id: string; profiles: { name: string | null; handle: string | null }[] | null }) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          return {
            ignored_user_id: r.ignored_user_id,
            name: p?.name ?? null,
            handle: p?.handle ?? null,
          }
        })
        setIgnored(rows)
        setLoading(false)
      })
  }, [userId])

  async function unignore(targetId: string) {
    setIgnored(prev => prev.filter(u => u.ignored_user_id !== targetId))
    const supabase = createClient()
    await supabase.from('user_ignores').delete().eq('user_id', userId).eq('ignored_user_id', targetId)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '44px', background: 'rgba(0,0,0,0.04)', borderRadius: '8px' }} />
        ))}
      </div>
    )
  }

  if (ignored.length === 0) {
    return (
      <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', lineHeight: '1.65' }}>
        You haven&apos;t ignored anyone.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {ignored.map(user => (
        <div
          key={user.ignored_user_id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div>
            <span className="font-body" style={{ fontSize: '14px', color: '#33261a', fontWeight: 500 }}>
              {user.name ?? user.handle ?? 'Unknown'}
            </span>
            {user.handle && (
              <span className="font-body" style={{ fontSize: '13px', color: '#6b5d4f', marginLeft: '6px' }}>
                @{user.handle}
              </span>
            )}
          </div>
          <button
            onClick={() => unignore(user.ignored_user_id)}
            className="font-body"
            style={{
              background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '7px',
              color: '#6b5d4f', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#33261a'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b5d4f'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
          >
            Unignore
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Section: Blocked Users ────────────────────────────────────────────────────

interface BlockedUser {
  blocked_id: string
  name: string | null
  handle: string | null
}

function BlockedUsersSection({ userId }: { userId: string }) {
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('user_blocks')
      .select('blocked_id, profiles:blocked_id(name, handle)')
      .eq('blocker_id', userId)
      .then(({ data }) => {
        const rows: BlockedUser[] = (data ?? []).map((r: { blocked_id: string; profiles: { name: string | null; handle: string | null }[] | null }) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
          return { blocked_id: r.blocked_id, name: p?.name ?? null, handle: p?.handle ?? null }
        })
        setBlocked(rows)
        setLoading(false)
      })
  }, [userId])

  async function unblock(targetId: string) {
    setBlocked(prev => prev.filter(u => u.blocked_id !== targetId))
    const supabase = createClient()
    await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '44px', background: 'rgba(0,0,0,0.04)', borderRadius: '8px' }} />
        ))}
      </div>
    )
  }

  if (blocked.length === 0) {
    return (
      <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', lineHeight: '1.65' }}>
        You haven&apos;t blocked anyone.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {blocked.map(user => (
        <div
          key={user.blocked_id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div>
            <span className="font-body" style={{ fontSize: '14px', color: '#33261a', fontWeight: 500 }}>
              {user.name ?? user.handle ?? 'Unknown'}
            </span>
            {user.handle && (
              <span className="font-body" style={{ fontSize: '13px', color: '#6b5d4f', marginLeft: '6px' }}>
                @{user.handle}
              </span>
            )}
          </div>
          <button
            onClick={() => unblock(user.blocked_id)}
            className="font-body"
            style={{
              background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '7px',
              color: '#6b5d4f', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#33261a'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b5d4f'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)' }}
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Section: About ────────────────────────────────────────────────────────────

function AboutSection() {
  const linkStyle: React.CSSProperties = {
    fontSize: '14px', color: '#6b5d4f', textDecoration: 'none', transition: 'color 0.15s',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body"
          style={linkStyle}
          onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
        >
          Privacy Policy ↗
        </a>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body"
          style={linkStyle}
          onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
        >
          Terms of Service ↗
        </a>
      </div>
      <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', lineHeight: '1.65' }}>
        Notable is a place to share the things that genuinely moved you — books, films, music, restaurants, and more. It&apos;s built for people who care about their recommendations and love discovering what the people they trust are into.
      </p>
      <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', marginTop: '4px' }}>
        Version 0.1.0
      </p>
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({ onCancel, onConfirm, deleting, error }: { onCancel: () => void; onConfirm: () => void; deleting: boolean; error: string | null }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', zIndex: 10,
      }}
    >
      <div style={{
        background: '#faf8f4',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: '14px',
        padding: '28px 24px',
        maxWidth: '360px', width: '100%',
      }}>
        <h3 className="font-display font-bold" style={{ fontSize: '1.05rem', color: '#33261a', marginBottom: '12px' }}>
          Delete your account?
        </h3>
        <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', lineHeight: '1.55', marginBottom: error ? '14px' : '24px' }}>
          This is permanent. Your account, all your recommendations, bookmarks and data will be deleted immediately. This cannot be undone.
        </p>
        {error && (
          <p className="font-body" style={{
            fontSize: '13px', color: '#e05555', lineHeight: '1.5',
            background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.22)',
            borderRadius: '8px', padding: '10px 12px', marginBottom: '18px',
          }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            className="font-body"
            style={{
              flex: 1, background: 'rgba(0,0,0,0.08)', border: 'none',
              borderRadius: '8px', color: '#6b5d4f', fontSize: '14px',
              padding: '10px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="font-body"
            style={{
              flex: 1, background: '#e05555', border: 'none',
              borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600,
              padding: '10px', cursor: 'pointer', opacity: deleting ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section config ────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'ignored', label: 'Ignored Users' },
  { id: 'blocked', label: 'Blocked Users' },
  { id: 'about', label: 'About' },
]

// ── Panel content (mounted/unmounted with animation) ─────────────────────────

function PanelContent({
  onClose,
  userId,
  initialProfile,
}: {
  onClose: () => void
  userId: string
  initialProfile: SettingsPanelProps['initialProfile']
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<Section>('account')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/login')
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    let res: Response
    try {
      res = await fetch('/api/account/delete', { method: 'DELETE' })
    } catch {
      setDeleteError('Could not reach the server. Check your connection and try again.')
      setDeleting(false)
      return
    }
    if (!res.ok) {
      let msg = 'Could not delete your account. Please try again.'
      try {
        const body = await res.json() as { error?: string }
        if (body.error) msg = body.error
      } catch { /* keep default */ }
      setDeleteError(msg)
      setDeleting(false)
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  function selectSection(s: Section) {
    setActiveSection(s)
    setMobileDetailOpen(true)
  }

  const sectionContent = (() => {
    switch (activeSection) {
      case 'account':
        return (
          <AccountSection
            userId={userId}
            initialName={initialProfile?.name ?? null}
            onSignOut={handleSignOut}
            onDeleteRequest={() => setShowDeleteModal(true)}
          />
        )
      case 'notifications':
        return <NotificationsSection userId={userId} />
      case 'privacy':
        return <PrivacySection userId={userId} />
      case 'ignored':
        return <IgnoredUsersSection userId={userId} />
      case 'blocked':
        return <BlockedUsersSection userId={userId} />
      case 'about':
        return <AboutSection />
    }
  })()

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: '56px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        <span className="font-body" style={{ fontSize: '13px', fontWeight: 600, color: '#33261a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Settings
        </span>
        <button
          onClick={onClose}
          aria-label="Close settings"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#6b5d4f', display: 'flex', alignItems: 'center', lineHeight: 0,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="20" height="20">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Desktop left nav */}
        <nav
          className="hidden md:flex flex-col"
          style={{
            width: 160, flexShrink: 0,
            borderRight: '1px solid rgba(0,0,0,0.08)',
            padding: '16px 0', overflowY: 'auto',
          }}
        >
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: 'block', width: '100%',
                padding: '11px 20px',
                background: activeSection === s.id ? 'rgba(0,0,0,0.04)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${activeSection === s.id ? '#33261a' : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <span className="font-body" style={{ fontSize: '14px', color: activeSection === s.id ? '#33261a' : '#6b5d4f', transition: 'color 0.15s' }}>
                {s.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Mobile: section list */}
          {!mobileDetailOpen && (
            <div
              className="flex flex-col md:hidden"
              style={{ flex: 1, overflowY: 'auto' }}
            >
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSection(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '17px 20px',
                    background: 'none', border: 'none',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span className="font-body" style={{ fontSize: '15px', color: '#33261a' }}>{s.label}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="1.8" strokeLinecap="round" width="16" height="16">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Desktop: content (always shown). Mobile: content (shown when mobileDetailOpen) */}
          <div
            className={!mobileDetailOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}
            style={{ flex: 1, overflow: 'hidden' }}
          >
            {/* Mobile back button */}
            <button
              className="flex md:hidden"
              onClick={() => setMobileDetailOpen(false)}
              style={{
                alignItems: 'center', gap: '8px',
                padding: '14px 20px',
                background: 'none', border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                cursor: 'pointer', color: '#6b5d4f', flexShrink: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="16" height="16">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="font-body" style={{ fontSize: '13px' }}>Back</span>
            </button>

            {/* Section content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 48px' }}>
              <h2
                className="font-display font-bold"
                style={{ fontSize: '1.1rem', color: '#33261a', marginBottom: '20px', letterSpacing: '-0.01em' }}
              >
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </h2>
              {sectionContent}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation — overlaid on the panel */}
      {showDeleteModal && (
        <DeleteModal
          onCancel={() => { setShowDeleteModal(false); setDeleteError(null) }}
          onConfirm={handleDelete}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </>
  )
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────

export default function SettingsPanel({ open, onClose, userId, initialProfile }: SettingsPanelProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 90,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Panel — always in DOM for smooth slide animation */}
      <div
        className="w-full md:w-[480px]"
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          background: '#f5f0e8',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          zIndex: 95,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {mounted && (
          <PanelContent
            onClose={onClose}
            userId={userId}
            initialProfile={initialProfile}
          />
        )}
      </div>
    </>
  )
}
