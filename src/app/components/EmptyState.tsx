import { theme } from '@/app/lib/theme'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '80px 24px 0', textAlign: 'center',
    }}>
      {icon && <div style={{ marginBottom: '16px' }}>{icon}</div>}
      <p className="font-display" style={{
        fontSize: '20px', fontWeight: 600, color: theme.colors.textPrimary,
        marginBottom: '8px', letterSpacing: '-0.01em',
      }}>
        {title}
      </p>
      <p className="font-body" style={{
        color: theme.colors.textMuted, fontSize: '14px',
        maxWidth: '280px', lineHeight: '1.55',
      }}>
        {description}
      </p>
    </div>
  )
}
