export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (file.type !== 'image/png') {
    throw new Error('O logo precisa ser um arquivo PNG.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Arquivo muito grande (máximo 5 MB).')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    let dataUrl = drawToDataUrl(image, 800)

    if (dataUrl.length > 500_000) {
      dataUrl = drawToDataUrl(image, 480)
    }

    if (dataUrl.length > 500_000) {
      throw new Error('Não consegui comprimir esse logo. Use um PNG menor.')
    }

    return dataUrl
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
    throw new Error('Não foi possível processar o logo.')
  }

  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
