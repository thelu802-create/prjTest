import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Cloud } from 'lucide-react'
import { HeroPanel } from '../features/memories/components/HeroPanel'
import { MemoryComposer } from '../features/memories/components/MemoryComposer'
import { MemoryTimeline } from '../features/memories/components/MemoryTimeline'
import { StatsGrid } from '../features/memories/components/StatsGrid'
import { useMemories } from '../features/memories/hooks/useMemories'
import { OneDriveStatusCard } from '../features/onedrive/components/OneDriveStatusCard'
import { useOneDrive } from '../features/onedrive/hooks/useOneDrive'
import type { MemoryDraft, MemoryPost } from '../shared/types/memory'
import { formatCurrentMonth, getTodayInputValue } from '../shared/utils/date'
import { readFileAsDataUrl } from '../shared/utils/file'
import './App.css'

const emptyDraft: MemoryDraft = {
  title: '',
  body: '',
  place: '',
  date: getTodayInputValue(),
  image: '',
  imageFile: null,
  fileName: '',
}

export function App() {
  const memories = useMemories()
  const oneDrive = useOneDrive()
  const [draft, setDraft] = useState<MemoryDraft>(emptyDraft)
  const [isSaving, setIsSaving] = useState(false)

  const updateDraft = (nextDraft: Partial<MemoryDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...nextDraft }))
  }

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    const image = await readFileAsDataUrl(selectedFile)
    updateDraft({
      fileName: selectedFile.name,
      image,
      imageFile: selectedFile,
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.title.trim() || !draft.body.trim() || !draft.image) {
      return
    }

    setIsSaving(true)

    try {
      const driveUrl = draft.imageFile ? await oneDrive.uploadImage(draft.imageFile) : undefined
      const nextPost: MemoryPost = {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        place: draft.place.trim() || 'Chưa gắn địa điểm',
        date: draft.date,
        image: draft.image,
        driveUrl,
        createdAt: new Date().toISOString(),
      }

      memories.addMemory(nextPost)
      setDraft({ ...emptyDraft, date: getTodayInputValue() })
    } catch {
      oneDrive.setUploadError()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Memory Cloud</p>
          <h1>Lưu kỷ niệm mỗi ngày</h1>
        </div>
        <button className="icon-button" aria-label="Trạng thái OneDrive" type="button">
          <Cloud size={20} />
        </button>
      </header>

      <HeroPanel latestPost={memories.latestPost} monthLabel={formatCurrentMonth()} />
      <StatsGrid
        imageCount={memories.posts.filter((post) => post.image).length}
        memoryCount={memories.posts.length}
      />

      <div className="desktop-layout">
        <aside className="left-column">
          <MemoryComposer
            draft={draft}
            isSaving={isSaving}
            onChange={updateDraft}
            onImageChange={handleImageChange}
            onSubmit={handleSubmit}
          />
          <OneDriveStatusCard
            account={oneDrive.account}
            isAuthReady={oneDrive.isAuthReady}
            isConfigured={oneDrive.isConfigured}
            onSignIn={oneDrive.signIn}
            onSignOut={oneDrive.signOut}
            syncMessage={oneDrive.syncMessage}
          />
        </aside>

        <MemoryTimeline
          onDelete={memories.deleteMemory}
          onQueryChange={memories.setQuery}
          posts={memories.filteredPosts}
          query={memories.query}
        />
      </div>
    </main>
  )
}
