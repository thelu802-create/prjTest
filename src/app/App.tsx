import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CircleHelp, Images, Settings } from 'lucide-react'
import { MemoryComposer } from '../features/memories/components/MemoryComposer'
import { MemoryTimeline } from '../features/memories/components/MemoryTimeline'
import { StatsGrid } from '../features/memories/components/StatsGrid'
import { useMemories } from '../features/memories/hooks/useMemories'
import { OneDriveStatusCard } from '../features/onedrive/components/OneDriveStatusCard'
import { useOneDrive } from '../features/onedrive/hooks/useOneDrive'
import type { MemoryDraft, MemoryPost } from '../shared/types/memory'
import { getTodayInputValue } from '../shared/utils/date'
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
  const [activeView, setActiveView] = useState<'album' | 'settings' | 'help'>('album')
  const [draft, setDraft] = useState<MemoryDraft>(emptyDraft)
  const [albumStatus, setAlbumStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const updateDraft = (nextDraft: Partial<MemoryDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...nextDraft }))
  }

  useEffect(() => {
    if (!oneDrive.account) {
      return
    }

    let isActive = true
    setAlbumStatus(`Loading memories from ${oneDrive.folderName}...`)

    oneDrive
      .loadMemories()
      .then(async (cloudPosts) => {
        const postsWithImages = await Promise.all(
          (cloudPosts ?? []).map(async (post) => {
            if (!post.driveItemId) {
              return post
            }

            try {
              return {
                ...post,
                image: await oneDrive.loadImage(post.driveItemId),
              }
            } catch {
              return post
            }
          }),
        )

        if (isActive) {
          memories.replaceMemories(postsWithImages)
          setAlbumStatus(`Loaded ${postsWithImages.length} memories from ${oneDrive.folderName}.`)
        }
      })
      .catch(() => {
        oneDrive.setUploadError()
        setAlbumStatus('Could not load memories from OneDrive.')
      })

    return () => {
      isActive = false
    }
  }, [oneDrive.account, oneDrive.folderName])

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

    if (!oneDrive.account) {
      setAlbumStatus('Connect OneDrive in Settings before saving.')
      setActiveView('settings')
      return
    }

    if (!draft.title.trim() || !draft.body.trim() || !draft.image) {
      setAlbumStatus('Add a title, note, and image before saving.')
      return
    }

    setIsSaving(true)
    setAlbumStatus(`Saving to ${oneDrive.folderName}...`)

    try {
      const uploadedItem = draft.imageFile ? await oneDrive.uploadImage(draft.imageFile) : undefined
      const nextPost: MemoryPost = {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        place: draft.place.trim() || 'No place set',
        date: draft.date,
        image: draft.image,
        driveItemId: uploadedItem?.id,
        driveUrl: uploadedItem?.webUrl,
        imageName: uploadedItem?.name,
        createdAt: new Date().toISOString(),
      }
      const nextPosts = [nextPost, ...memories.posts]

      await oneDrive.saveMemories(nextPosts)
      memories.replaceMemories(nextPosts)
      setDraft({ ...emptyDraft, date: getTodayInputValue() })
      setAlbumStatus('Saved to OneDrive.')
    } catch {
      oneDrive.setUploadError()
      setAlbumStatus('Save failed. Check your OneDrive connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    const confirmed = window.confirm('Delete this memory from the current folder?')

    if (!confirmed) {
      return
    }

    const nextPosts = memories.deleteMemory(id)
    setAlbumStatus('Deleting memory...')

    try {
      await oneDrive.saveMemories(nextPosts)
      setAlbumStatus('Memory deleted.')
    } catch {
      oneDrive.setUploadError()
      setAlbumStatus('Delete failed. The local list changed, but OneDrive was not updated.')
    }
  }

  return (
    <main className="app-shell">
      <nav className="app-nav" aria-label="Main navigation">
        <button
          className={activeView === 'album' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('album')}
          type="button"
        >
          <Images size={17} />
          Album
        </button>
        <button
          className={activeView === 'settings' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('settings')}
          type="button"
        >
          <Settings size={17} />
          Settings
        </button>
        <button
          className={activeView === 'help' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveView('help')}
          type="button"
        >
          <CircleHelp size={17} />
          Help
        </button>
      </nav>

      {activeView === 'album' ? (
        <>
          <StatsGrid
            imageCount={memories.posts.filter((post) => post.image).length}
            memoryCount={memories.posts.length}
          />

          <div className="desktop-layout">
            <aside className="left-column">
              <MemoryComposer
                canSave={Boolean(oneDrive.account)}
                draft={draft}
                isSaving={isSaving}
                onChange={updateDraft}
                onImageChange={handleImageChange}
                onSubmit={handleSubmit}
              />
            </aside>

            <MemoryTimeline
              folderName={oneDrive.folderName}
              isConnected={Boolean(oneDrive.account)}
              onDelete={handleDeleteMemory}
              onQueryChange={memories.setQuery}
              posts={memories.filteredPosts}
              query={memories.query}
              statusMessage={albumStatus}
            />
          </div>
        </>
      ) : activeView === 'settings' ? (
        <section className="settings-layout">
          <OneDriveStatusCard
            account={oneDrive.account}
            folderName={oneDrive.folderName}
            folderOptions={oneDrive.folderOptions}
            isAuthReady={oneDrive.isAuthReady}
            isConfigured={oneDrive.isConfigured}
            isLoadingFolders={oneDrive.isLoadingFolders}
            onFolderChange={oneDrive.changeFolder}
            onRefreshFolders={oneDrive.refreshFolders}
            onSignIn={oneDrive.signIn}
            onSignOut={oneDrive.signOut}
            syncMessage={oneDrive.syncMessage}
          />
        </section>
      ) : (
        <section className="help-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Guide</p>
              <h2>How to use Memory Cloud</h2>
            </div>
            <CircleHelp size={22} />
          </div>
          <div className="help-grid">
            <article>
              <h3>1. Connect OneDrive</h3>
              <p>Open Settings, connect your Microsoft account, then choose where memories are stored.</p>
            </article>
            <article>
              <h3>2. Choose a folder</h3>
              <p>Select an existing OneDrive folder, or type a new folder name and apply it.</p>
            </article>
            <article>
              <h3>3. Save memories</h3>
              <p>Go to Album, add an image, title, note, place, and date, then save.</p>
            </article>
            <article>
              <h3>4. Open anywhere</h3>
              <p>Use the same Microsoft account on another device to load the same OneDrive folder.</p>
            </article>
          </div>
        </section>
      )}
    </main>
  )
}

