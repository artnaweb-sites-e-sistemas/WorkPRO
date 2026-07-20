export interface ParsedProjectDetailsTags {
  projectDetails: string
  projectTitle: string | null
  clientName: string | null
}

export interface ParseProjectDetailsTagsOptions {
  /** Permite extrair tag na última linha sem quebra (ex.: colar texto). */
  allowEndOfString?: boolean
}

function extractTag(
  input: string,
  tag: 'nome_do_projeto' | 'nome_do_cliente',
  options: ParseProjectDetailsTagsOptions,
): { value: string | null; text: string } {
  const endPattern = options.allowEndOfString ? '(?:\\r?\\n|$)' : '\\r?\\n'
  const regex = new RegExp(
    `(^|\\r?\\n)[ \\t]*#${tag}:[ \\t]*([^\\n\\r#]+)[ \\t]*${endPattern}`,
    'i',
  )
  const match = input.match(regex)

  if (!match) {
    return { value: null, text: input }
  }

  const value = match[2].trim()
  const text = input.replace(regex, (_full, lineStart: string) => (lineStart === '' ? '' : '\n'))

  return { value, text }
}

export function shouldParseProjectDetails(
  text: string,
  allowEndOfString: boolean,
): boolean {
  if (!/#nome_do_(?:projeto|cliente):/i.test(text)) {
    return false
  }

  if (allowEndOfString) {
    return true
  }

  return /#nome_do_projeto:[^\n\r]*\r?\n|#nome_do_cliente:[^\n\r]*\r?\n/i.test(text)
}

export function parseProjectDetailsTags(
  text: string,
  options: ParseProjectDetailsTagsOptions = {},
): ParsedProjectDetailsTags {
  if (!shouldParseProjectDetails(text, Boolean(options.allowEndOfString))) {
    return { projectDetails: text, projectTitle: null, clientName: null }
  }

  const project = extractTag(text, 'nome_do_projeto', options)
  const client = extractTag(project.text, 'nome_do_cliente', options)
  const extracted = project.value ?? client.value

  let projectDetails = client.text

  if (extracted) {
    projectDetails = client.text.replace(/\n{3,}/g, '\n\n')

    if (options.allowEndOfString) {
      projectDetails = projectDetails.trim()
    }
  }

  return {
    projectDetails,
    projectTitle: project.value,
    clientName: client.value,
  }
}
