export function sanitizeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, '-').trim() || 'Proposta'
}
