const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
])

interface CompressOptions {
  /** Largura máxima inicial (px). */
  maxWidth?: number
  /** Tamanho máximo do data URL (caracteres). Firestore ~1MB por documento. */
  maxChars?: number
}

function isAllowedImage(file: File): boolean {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return true
  }

  const name = file.name.toLowerCase()
  return /\.(png|jpe?g|webp|gif|bmp)$/.test(name)
}

/** Logo da capa — um pouco maior. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  return fileToCompressedPngDataUrl(file, { maxWidth: 640, maxChars: 280_000 })
}

/** Símbolo / marca d'água — mais leve para caber junto com a logo no Firestore. */
export async function fileToMarkDataUrl(file: File): Promise<string> {
  return fileToCompressedPngDataUrl(file, { maxWidth: 420, maxChars: 180_000 })
}

async function fileToCompressedPngDataUrl(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  const maxWidth = options.maxWidth ?? 640
  const maxChars = options.maxChars ?? 280_000

  if (!isAllowedImage(file)) {
    throw new Error('Use uma imagem PNG, JPG, WEBP, GIF ou BMP.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Arquivo muito grande (máximo 5 MB).')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const widths = [maxWidth, Math.round(maxWidth * 0.7), Math.round(maxWidth * 0.5), 240]

    for (const width of widths) {
      const dataUrl = drawToDataUrl(image, width)
      if (dataUrl.length <= maxChars) {
        return dataUrl
      }
    }

    throw new Error('Não consegui comprimir essa imagem. Use um arquivo menor.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'))
    image.src = src
  })
}

function drawToDataUrl(image: HTMLImageElement, maxWidth: number): string {
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
  return canvas.toDataURL('image/png')
}
