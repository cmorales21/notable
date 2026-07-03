// supabase-js never throws — errors come back in the result object, and an
// un-awaited builder never executes. This helper forces both: it awaits the
// write and routes failures through a rollback callback.
export async function checkedWrite(
  write: PromiseLike<{ error: { message: string } | null }>,
  onFailure?: () => void
): Promise<boolean> {
  const { error } = await write
  if (!error) return true
  if (process.env.NODE_ENV !== 'production') console.error('[Notable] write failed:', error.message)
  onFailure?.()
  return false
}
