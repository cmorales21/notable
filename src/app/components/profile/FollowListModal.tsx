'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { checkedWrite } from '@/lib/writes'
import { Avatar } from '@/app/components/Avatar'
import { FollowRowButton } from './FollowRowButton'
import { useToast } from '@/app/components/Toast'

interface FollowUser {
  id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
  profile_private?: boolean | null
}

export function FollowListModal({
  type, profileId, currentUserId, onClose,
}: {
  type: 'followers' | 'following'
  profileId: string
  currentUserId: string | null
  onClose: () => void
}) {
  const supabase = useRef(createClient())
  const toast = useToast()
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      let userIds: string[] = []

      if (type === 'followers') {
        const { data } = await supabase.current
          .from('follows').select('follower_id').eq('following_id', profileId).eq('status', 'accepted')
        userIds = (data ?? []).map((f: { follower_id: string }) => f.follower_id)
      } else {
        const { data } = await supabase.current
          .from('follows').select('following_id').eq('follower_id', profileId).eq('status', 'accepted')
        userIds = (data ?? []).map((f: { following_id: string }) => f.following_id)
      }

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.current
          .from('profiles').select('id, name, handle, avatar_url, profile_private').in('id', userIds)
        setUsers(profilesData ?? [])

        if (currentUserId) {
          const { data: myFollows } = await supabase.current
            .from('follows').select('following_id')
            .eq('follower_id', currentUserId).eq('status', 'accepted').in('following_id', userIds)
          setFollowedIds(new Set((myFollows ?? []).map((f: { following_id: string }) => f.following_id)))
        }
      }

      setLoading(false)
    }
    load()
  }, [type, profileId, currentUserId])

  async function toggleFollow(targetId: string) {
    if (!currentUserId || pending.has(targetId)) return
    setPending(prev => new Set([...prev, targetId]))
    if (followedIds.has(targetId)) {
      const ok = await checkedWrite(
        supabase.current.from('follows').delete()
          .eq('follower_id', currentUserId).eq('following_id', targetId)
      )
      if (ok) {
        setFollowedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
      } else {
        toast('Couldn’t unfollow. Please try again.')
      }
    } else {
      const targetUser = users.find(u => u.id === targetId)
      const isPrivate = targetUser?.profile_private === true
      const ok = await checkedWrite(
        supabase.current.from('follows').insert({
          follower_id: currentUserId,
          following_id: targetId,
          ...(isPrivate ? { status: 'pending' } : {}),
        })
      )
      if (ok) {
        if (!isPrivate) {
          setFollowedIds(prev => new Set([...prev, targetId]))
        }
      } else {
        toast('Couldn’t follow. Please try again.')
      }
    }
    setPending(prev => { const n = new Set(prev); n.delete(targetId); return n })
  }

  const title = type === 'followers' ? 'Followers' : 'Following'
  const emptyMsg = type === 'followers' ? 'No followers yet' : 'Not following anyone yet'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          background: '#faf8f4',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 32px 80px rgba(58,42,26,0.5)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}>
          <h2 className="font-display" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#33261a' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b5d4f', display: 'flex', padding: '4px', borderRadius: '6px',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '12px 20px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
                  <div className="skeleton-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: '#efe9e0', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-pulse" style={{ height: 13, width: '42%', borderRadius: 6, background: '#efe9e0', marginBottom: 6 }} />
                    <div className="skeleton-pulse" style={{ height: 11, width: '26%', borderRadius: 6, background: '#efe9e0' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '44px 20px', textAlign: 'center' }}>
              <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px' }}>{emptyMsg}</p>
            </div>
          ) : (
            <div style={{ padding: '6px 0 10px' }}>
              {users.map(user => (
                <div
                  key={user.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 20px' }}
                >
                  {user.handle ? (
                    <Link href={`/profile/${user.handle}`} onClick={onClose} style={{ lineHeight: 0, flexShrink: 0 }}>
                      <Avatar url={user.avatar_url} name={user.name} size={36} />
                    </Link>
                  ) : (
                    <Avatar url={user.avatar_url} name={user.name} size={36} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {user.handle ? (
                      <Link
                        href={`/profile/${user.handle}`}
                        onClick={onClose}
                        className="font-body"
                        style={{
                          display: 'block', color: '#33261a', fontSize: '14px', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: 'none',
                        }}
                      >
                        {user.name ?? user.handle}
                      </Link>
                    ) : (
                      <p className="font-body" style={{
                        color: '#33261a', fontSize: '14px', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.name ?? user.handle}
                      </p>
                    )}
                    {user.handle && (
                      <Link
                        href={`/profile/${user.handle}`}
                        onClick={onClose}
                        className="font-body"
                        style={{ display: 'block', color: '#6b5d4f', fontSize: '12px', textDecoration: 'none' }}
                      >
                        @{user.handle}
                      </Link>
                    )}
                  </div>
                  {user.id !== currentUserId && currentUserId && (
                    <FollowRowButton
                      following={followedIds.has(user.id)}
                      pending={pending.has(user.id)}
                      onToggle={() => toggleFollow(user.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
