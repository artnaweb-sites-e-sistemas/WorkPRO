const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg'])

function isAllowedImage(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) {
    return true
  }

  const name = file.name.toLowerCase()
  return /\.(png|jpe?g)$/.test(name)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'))
    image.src = src
  })
}

/** Print da ferramenta — JPEG, largura máxima 1400px, qualidade 0.82. */
export async function fileToScreenshotDataUrl(file: File): Promise<string> {
  if (!isAllowedImage(file)) {
    throw new Error('Use uma imagem PNG ou JPG.')
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Arquivo muito grande (máximo 8 MB).')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const maxWidth = 1400
    const scale = image.width > maxWidth ? maxWidth / image.width : 1
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Não foi possível processar a imagem.')
    }

    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
