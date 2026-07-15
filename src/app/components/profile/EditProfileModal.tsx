'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/Toast'
import { friendlyError } from '@/lib/friendlyError'
import { type FullProfile } from './types'
import { Avatar } from '@/app/components/Avatar'

export function EditProfileModal({
  profile, currentUserId, onClose, onSave,
}: {
  profile: FullProfile
  currentUserId: string | null
  onClose: () => void
  onSave: (updates: { name: string; bio: string; avatar_url: string | null }) => void
}) {
  const supabase = useRef(createClient())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [name, setName] = useState(profile.name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, WebP, or GIF images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB')
      return
    }
    setUploading(true)
    try {
      const mimeToExt: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
      const ext = mimeToExt[file.type] ?? 'jpg'
      const path = `${currentUserId}/avatar.${ext}`
      const { error: upErr } = await supabase.current.storage
        .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.current.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(publicUrl)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error: updateErr } = await supabase.current
        .from('profiles')
        .update({ name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl })
        .eq('id', currentUserId)
      if (updateErr) throw updateErr
      toast('Profile saved')
      onSave({ name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl })
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#faf8f4',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '24px 24px 22px',
        boxShadow: '0 32px 80px rgba(58,42,26,0.5)',
      }}>
        <h2 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#33261a', marginBottom: '20px' }}>
          Edit Profile
        </h2>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}
            title="Change photo"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile photo" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,0,0,0.1)', display: 'block' }} />
            ) : (
              <Avatar variant="gradient" name={name} size={56} />
            )}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: uploading ? 1 : 0, transition: 'opacity 0.15s',
            }}>
              {uploading && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16"
                  style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
            </div>
          </button>
          <div>
            <p className="font-body" style={{ color: '#33261a', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Photo</p>
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px' }}>Click to change</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="font-body"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '10px', padding: '9px 13px',
              color: '#33261a', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '14px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Bio <span style={{ color: '#6b5d4f' }}>({160 - bio.length} left)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 160))}
            rows={2}
            className="font-body"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '10px', padding: '9px 13px',
              color: '#33261a', fontSize: '14px', outline: 'none',
              resize: 'none', lineHeight: 1.6,
            }}
          />
        </div>

        {/* Handle — read-only */}
        <div style={{ marginBottom: '20px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Handle</label>
          <p className="font-body" style={{ color: '#4a4438', fontSize: '14px', padding: '9px 0' }}>
            @{profile.handle}
          </p>
        </div>

        {error && (
          <p className="font-body" style={{ color: '#e05555', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="font-body"
            style={{
              background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '20px', padding: '7px 18px',
              color: '#6b5d4f', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="font-body"
            style={{
              background: saving ? '#e8e0d4' : '#33261a',
              border: 'none', borderRadius: '20px', padding: '7px 18px',
              color: '#f5f0e8', fontSize: '13px', fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
