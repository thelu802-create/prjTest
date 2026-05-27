import { useMemo, useState } from 'react'
import type { MemoryPost } from '../../../shared/types/memory'
import { loadMemories } from '../services/memoryStorage'

export function useMemories() {
  const [posts, setPosts] = useState<MemoryPost[]>(() => loadMemories())
  const [query, setQuery] = useState('')

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
    const nextPosts = [post, ...posts]
    setPosts(nextPosts)

    return nextPosts
  }

  const deleteMemory = (id: string) => {
    const nextPosts = posts.filter((post) => post.id !== id)
    setPosts(nextPosts)

    return nextPosts
  }

  const replaceMemories = (nextPosts: MemoryPost[]) => {
    setPosts(nextPosts)
  }

  return {
    addMemory,
    deleteMemory,
    filteredPosts,
    latestPost: posts[0],
    posts,
    query,
    replaceMemories,
    setQuery,
  }
}
