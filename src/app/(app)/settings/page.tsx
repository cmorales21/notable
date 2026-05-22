'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px 0',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div>
        <p className="font-body" style={{ fontSize: '15px', color: 'var(--color-text)', marginBottom: '3px' }}>
          {label}
        </p>
        <p className="font-body" style={{ fontSize: '13px', color: '#6b5d4f', lineHeight: '1.4' }}>
          {description}
        </p>
      </div>

      {/* Pill toggle */}
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          flexShrink: 0,
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          background: checked ? '#4aad4e' : 'rgba(0,0,0,0.08)',
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
            left: checked ? '23px' : '3px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#faf8f4',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-body"
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#6b5d4f',
        marginTop: '32px',
        marginBottom: '4px',
      }}
    >
      {children}
    </h2>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [notifyBookmarks, setNotifyBookmarks] = useState(true)
  const [emailOptedIn, setEmailOptedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('profiles')
        .select('notify_bookmarks, email_opted_in')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setNotifyBookmarks(data.notify_bookmarks ?? true)
            setEmailOptedIn(data.email_opted_in ?? false)
          }
          setLoading(false)
        })
    })
  }, [])

  const saveField = async (patch: Record<string, boolean>) => {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('profiles').update(patch).eq('id', userId)
  }

  const handleNotifyBookmarks = (val: boolean) => {
    setNotifyBookmarks(val)
    saveField({ notify_bookmarks: val })
  }

  const handleEmailOptedIn = (val: boolean) => {
    setEmailOptedIn(val)
    saveField({ email_opted_in: val })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 20px 60px' }}>
      <h1
        className="font-display font-bold"
        style={{ fontSize: '1.4rem', letterSpacing: '-0.02em', color: 'var(--color-text)', marginBottom: '8px' }}
      >
        Settings
      </h1>

      {loading ? (
        <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '14px', marginTop: '24px' }}>
          Loading…
        </p>
      ) : (
        <>
          <SectionHeading>Notifications</SectionHeading>

          <ToggleRow
            label="Bookmark notifications"
            description="Get notified when someone saves one of your posts."
            checked={notifyBookmarks}
            onChange={handleNotifyBookmarks}
          />

          <ToggleRow
            label="Email digest"
            description="Receive a weekly email summary of your notifications."
            checked={emailOptedIn}
            onChange={handleEmailOptedIn}
          />

          <SectionHeading>Account</SectionHeading>

          <div style={{ paddingTop: '12px' }}>
            <button
              onClick={handleSignOut}
              className="font-body"
              style={{
                background: 'none',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '8px',
                color: '#6b5d4f',
                fontSize: '14px',
                padding: '9px 18px',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
