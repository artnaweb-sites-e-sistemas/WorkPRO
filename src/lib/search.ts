export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesConversationSearch(
  clientName: string,
  projectTitle: string,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return true
  }

  return (
    normalizeSearchText(clientName).includes(normalizedQuery) ||
    normalizeSearchText(projectTitle).includes(normalizedQuery)
  )
}

export function matchesProposalSearch(
  companyName: string,
  projectTitle: string,
  query: string,
): boolean {
  return matchesConversationSearch(companyName, projectTitle, query)
}
