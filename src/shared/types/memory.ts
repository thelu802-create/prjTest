export type MemoryMedia = {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnailUrl?: string
  name?: string
  driveItemId?: string
  driveUrl?: string
  fileSize?: number
}

export type MemoryDraftMedia = MemoryMedia & {
  file: File
}

export type MemoryPost = {
  id: string
  title: string
  body: string
  place: string
  date: string
  image: string
  mediaType?: 'image' | 'video'
  mediaItems?: MemoryMedia[]
  driveItemId?: string
  imageName?: string
  mediaName?: string
  fileSize?: number
  driveUrl?: string
  syncStatus?: 'synced' | 'syncing' | 'failed'
  syncError?: string
  createdAt: string
}

export type MemoryDraft = {
  title: string
  body: string
  place: string
  date: string
  image: string
  mediaType: 'image' | 'video'
  imageFile: File | null
  fileName: string
  mediaItems: MemoryDraftMedia[]
}
