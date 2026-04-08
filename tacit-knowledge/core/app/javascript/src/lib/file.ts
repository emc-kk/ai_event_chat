export const SUPPORTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'application/pdf',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
]

export const isValidFileType = (file: File): boolean => {
  return SUPPORTED_FILE_TYPES.includes(file.type)
}

export const processFiles = (files: FileList): File[] => {
  const validFiles: File[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (isValidFileType(file)) {
      validFiles.push(file)
    } else {
      alert(`${file.name}はサポートされていないファイル形式です。`)
    }
  }
  
  return validFiles
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

