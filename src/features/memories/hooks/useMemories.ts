import { useEffect, useMemo, useState } from 'react'
import type { MemoryPost } from '../../../shared/types/memory'
import { loadMemories, saveMemories } from '../services/memoryStorage'

export function useMemories() {
  const [posts, setPosts] = useState<MemoryPost[]>(() => loadMemories())
  const [query, setQuery] = useState('')

  useEffect(() => {
    saveMemories(posts)
  }, [posts])

  const filteredPosts = useMemo(() => {
    const keyword = query.toLowerCase().trim()

    if (!keyword) {
      return posts
    }

    return posts.filter((post) =>
      `${post.title} ${post.body} ${post.place}`.toLowerCase().includes(keyword),
    )
  }, [posts, query])

  const addMemory = (post: MemoryPost) => {
    setPosts((currentPosts) => [post, ...currentPosts])
  }

  const deleteMemory = (id: string) => {
    setPosts((currentPosts) => currentPosts.filter((post) => post.id !== id))
  }

  return {
    addMemory,
    deleteMemory,
    filteredPosts,
    latestPost: posts[0],
    posts,
    query,
    setQuery,
  }
}
