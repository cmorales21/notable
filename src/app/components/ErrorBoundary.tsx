'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { theme } from '@/app/lib/theme'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.colors.bg,
            color: theme.colors.textPrimary,
            fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '400px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.4 }}>✦</div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: '0.95rem',
                color: theme.colors.textMuted,
                lineHeight: 1.6,
                marginBottom: '2rem',
              }}
            >
              A small hiccup on our end. Your recommendations aren&apos;t going anywhere.
            </p>
            <button
              onClick={this.reset}
              style={{
                background: theme.colors.textPrimary,
                color: theme.colors.surface,
                border: 'none',
                borderRadius: '20px',
                padding: '0.75rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
