import type { MemoryPost } from '../../../shared/types/memory'
import { starterMemories } from '../data/starterMemories'

const STORAGE_KEY = 'memory-posts'

export function loadMemories() {
  const savedPosts = localStorage.getItem(STORAGE_KEY)

  if (!savedPosts) {
    return starterMemories
  }

  try {
    return JSON.parse(savedPosts) as MemoryPost[]
  } catch {
    return starterMemories
  }
}

export function saveMemories(posts: MemoryPost[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}
