import { redirect } from 'next/navigation'

// The standalone /post page was removed — posting happens via PostModal
// (opened from AppShell). Redirect old deep links to the lobby.
export default function PostRedirectPage() {
  redirect('/lobby')
}
