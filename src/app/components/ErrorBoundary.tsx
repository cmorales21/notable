'use client'

import React from 'react'

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
            background: '#f5f0e8',
            color: '#33261a',
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
                color: '#6b5d4f',
                lineHeight: 1.6,
                marginBottom: '2rem',
              }}
            >
              A small hiccup on our end. Your recommendations aren&apos;t going anywhere.
            </p>
            <button
              onClick={this.reset}
              style={{
                background: '#5271FF',
                color: '#f5f0e8',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(82,113,255,0.3)',
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
