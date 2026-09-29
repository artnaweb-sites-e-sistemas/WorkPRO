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

export function matchesPilotoSearch(
  leadCompanyName: string,
  leadNiche: string,
  leadCity: string,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return true
  }

  return (
    normalizeSearchText(leadCompanyName).includes(normalizedQuery) ||
    normalizeSearchText(leadNiche).includes(normalizedQuery) ||
    normalizeSearchText(leadCity).includes(normalizedQuery)
  )
}
