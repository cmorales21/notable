export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : undefined
  } catch {
    return undefined
  }
}

// True iff `host` is exactly `domain` or a subdomain of it (`*.<domain>`).
// Case-insensitive. Used to allowlist hosts without the `evil-domain.com.attacker.com`
// bypass that a naive `includes()` would let through.
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase()
  const d = domain.toLowerCase()
  return h === d || h.endsWith('.' + d)
}
