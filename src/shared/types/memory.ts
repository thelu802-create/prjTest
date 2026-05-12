export type MemoryPost = {
  id: string
  title: string
  body: string
  place: string
  date: string
  image: string
  driveUrl?: string
  createdAt: string
}

export type MemoryDraft = {
  title: string
  body: string
  place: string
  date: string
  image: string
  imageFile: File | null
  fileName: string
}
