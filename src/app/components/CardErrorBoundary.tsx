'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

// Per-card error boundary: isolates a single card render failure so it
// can't bring down the whole feed. Renders nothing on error (the card
// silently collapses); Sentry still captures the exception.
export default class CardErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack, boundary: 'card' } })
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
