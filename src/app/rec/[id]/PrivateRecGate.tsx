'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { checkedWrite } from '@/lib/writes'
import { theme } from '@/app/lib/theme'
import { PublicHeader } from './PublicHeader'

// Private-rec gate. The person is visible; the content is not.
// The component is trusted with owner identity fields only — never with
// rec title, description, image, category, or created_at.
//
// Three states:
//  - Logged-out visitor          → Join Notable + Sign in (both carry ?next=)
//  - Logged-in non-follower      → Request to follow + Back to the Lobby
//  - Logged-in with pending req  → Request sent, Explore the Lobby
//
// Signing in does not unlock a private rec; only an accepted follow does.
// Copy avoids promising access in exchange for signing up.

type Props = {
  viewer:
    | { loggedIn: false }
    | { loggedIn: true; userId: string }
  initialFollowState: 'none' | 'pending'
  recipientUserId: string
  ownerName: string | null
  ownerHandle: string | null
  ownerAvatarUrl: string | null
  nextUrl: string
}

export function PrivateRecGate(props: Props) {
  const {
    viewer, initialFollowState, recipientUserId,
    ownerName, ownerHandle, ownerAvatarUrl, nextUrl,
  } = props

  const [followState, setFollowState] = useState<'none' | 'pending'>(initialFollowState)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const supabase = createClient()

  const trimmedName = ownerName?.trim() || null
  const trimmedHandle = ownerHandle?.trim() || null
  const visibleName = trimmedName ?? (trimmedHandle ? `@${trimmedHandle}` : 'This person')
  const headline = trimmedHandle ? `@${trimmedHandle} is a private account.` : 'This account is private.'
  const encodedNext = encodeURIComponent(nextUrl)

  async function handleRequestFollow() {
    if (!viewer.loggedIn || sending) return
    setSending(true)
    setErrorMsg(null)
    const ok = await checkedWrite(
      supabase.from('follows').insert({
        follower_id: viewer.userId,
        following_id: recipientUserId,
        status: 'pending',
      })
    )
    setSending(false)
    if (ok) {
      setFollowState('pending')
    } else {
      setErrorMsg("Couldn't send the request. Please try again.")
    }
  }

  return (
    <>
      {!viewer.loggedIn && <PublicHeader nextUrl={nextUrl} />}

      <div
        style={{
          minHeight: viewer.loggedIn ? '80vh' : '70vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '380px', width: '100%' }}>

          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
            {ownerAvatarUrl ? (
              <Image
                src={ownerAvatarUrl}
                alt={visibleName}
                width={80}
                height={80}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: theme.colors.avatarFallback,
                border: `1px solid ${theme.colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, color: theme.colors.textPrimary, fontWeight: 500,
                fontFamily: theme.fonts.body,
              }}>
                {visibleName.replace(/^@/, '').charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Name + @handle */}
          <p
            className="font-body"
            style={{
              fontSize: '16px', fontWeight: 500,
              color: theme.colors.textPrimary,
              margin: '0 0 2px',
            }}
          >
            {visibleName.replace(/^@/, '') || 'Someone on Notable'}
          </p>
          {trimmedHandle && (
            <p
              className="font-body"
              style={{
                fontSize: '13px', color: theme.colors.textMuted, margin: 0,
              }}
            >
              @{trimmedHandle}
            </p>
          )}

          {/* Headline + body per state */}
          {followState === 'pending' ? (
            <>
              <p
                className="font-display"
                style={{
                  fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em',
                  color: theme.colors.textPrimary,
                  margin: '24px 0 10px',
                }}
              >
                Request sent.
              </p>
              <p
                className="font-body"
                style={{
                  fontSize: '15px', color: theme.colors.textMuted,
                  lineHeight: 1.55, margin: '0 0 24px',
                }}
              >
                In the meantime, the Lobby is full of things worth your time.
              </p>
              <Link
                href="/lobby"
                className="font-body"
                style={{
                  display: 'inline-block', padding: '11px 26px',
                  background: theme.categoryColors.books, color: '#ffffff',
                  borderRadius: theme.radii.pill,
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                Explore the Lobby
              </Link>
            </>
          ) : (
            <>
              <p
                className="font-display"
                style={{
                  fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em',
                  color: theme.colors.textPrimary,
                  margin: '24px 0 10px',
                }}
              >
                {headline}
              </p>

              {!viewer.loggedIn ? (
                <>
                  <p
                    className="font-body"
                    style={{
                      fontSize: '15px', color: theme.colors.textMuted,
                      lineHeight: 1.55, margin: '0 0 24px',
                    }}
                  >
                    Join Notable to request to follow and see what they share.
                  </p>
                  <Link
                    href={`/signup?next=${encodedNext}`}
                    className="font-body"
                    style={{
                      display: 'inline-block', padding: '11px 26px',
                      background: theme.categoryColors.books, color: '#ffffff',
                      borderRadius: theme.radii.pill,
                      fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    Join Notable
                  </Link>
                  <div style={{ marginTop: '14px' }}>
                    <Link
                      href={`/login?next=${encodedNext}`}
                      className="font-body"
                      style={{
                        fontSize: '13px', color: theme.colors.textMuted,
                        textDecoration: 'none',
                      }}
                    >
                      Already a member? <span style={{ color: theme.categoryColors.books, fontWeight: 500 }}>Sign in</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p
                    className="font-body"
                    style={{
                      fontSize: '15px', color: theme.colors.textMuted,
                      lineHeight: 1.55, margin: '0 0 24px',
                    }}
                  >
                    Send a follow request to see what they share.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestFollow}
                    disabled={sending}
                    className="font-body"
                    style={{
                      padding: '11px 26px', border: 'none',
                      background: theme.categoryColors.books, color: '#ffffff',
                      borderRadius: theme.radii.pill,
                      fontSize: '14px', fontWeight: 600,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.7 : 1,
                    }}
                  >
                    {sending ? 'Sending…' : 'Request to follow'}
                  </button>
                  <div style={{ marginTop: '14px' }}>
                    <Link
                      href="/lobby"
                      className="font-body"
                      style={{
                        fontSize: '13px', color: theme.colors.textMuted,
                        textDecoration: 'none',
                      }}
                    >
                      Back to the Lobby
                    </Link>
                  </div>
                  {errorMsg && (
                    <p
                      className="font-body"
                      style={{
                        color: theme.colors.error, fontSize: '13px',
                        marginTop: '16px',
                      }}
                    >
                      {errorMsg}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
