export type MemoryPost = {
  id: string
  title: string
  body: string
  place: string
  date: string
  image: string
  mediaType?: 'image' | 'video'
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
}
