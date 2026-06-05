import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CircleHelp, Images, Settings } from 'lucide-react'
import { MemoryComposer } from '../features/memories/components/MemoryComposer'
import { MemoryTimeline } from '../features/memories/components/MemoryTimeline'
import { StatsGrid } from '../features/memories/components/StatsGrid'
import { useMemories } from '../features/memories/hooks/useMemories'
import { OneDriveStatusCard } from '../features/onedrive/components/OneDriveStatusCard'
import { useOneDrive } from '../features/onedrive/hooks/useOneDrive'
import type { MemoryDraft, MemoryPost } from '../shared/types/memory'
import {
  formatMonthLabel,
  getCurrentMonthInputValue,
  getMonthInputValue,
  getTodayInputValue,
} from '../shared/utils/date'
import './App.css'

const emptyDraft: MemoryDraft = {
  title: '',
  body: '',
  place: '',
  date: getTodayInputValue(),
  image: '',
  mediaType: 'image',
  imageFile: null,
  fileName: '',
}

export function App() {
  const memories = useMemories()
  const oneDrive = useOneDrive()
  const { replaceMemories } = memories
  const {
    account,
    folderName,
    loadImage,
    loadLegacyMemories,
    loadMemories,
    setUploadError,
  } = oneDrive
  const [activeView, setActiveView] = useState<'album' | 'settings' | 'help'>('album')
  const [draft, setDraft] = useState<MemoryDraft>(emptyDraft)
  const [albumStatus, setAlbumStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInputValue())
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const updateDraft = (nextDraft: Partial<MemoryDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...nextDraft }))
  }

  const loadSelectedMonth = useCallback(async (lifecycle: { isActive: boolean }) => {
    if (!account || !lifecycle.isActive) {
      return
    }

    setAlbumStatus(`Loading ${formatMonthLabel(selectedMonth)} from ${folderName}...`)

    try {
      const cloudPosts = await loadMemories(selectedMonth)
      const legacyPosts = cloudPosts ? null : await loadLegacyMemories()
      const monthlyPosts =
        cloudPosts ?? legacyPosts?.filter((post) => getMonthInputValue(post.date) === selectedMonth)

      const postsWithImages = await Promise.all(
        (monthlyPosts ?? []).map(async (post) => {
          if (!post.driveItemId) {
            return post
          }

          try {
            return {
              ...post,
              image: await loadImage(post.driveItemId),
            }
          } catch {
            return post
          }
        }),
      )

      if (lifecycle.isActive) {
        replaceMemories(postsWithImages)
        setAlbumStatus(
          `Loaded ${postsWithImages.length} memories from ${formatMonthLabel(selectedMonth)}.`,
        )
      }
    } catch {
      if (lifecycle.isActive) {
        setUploadError()
        setAlbumStatus('Could not load memories from OneDrive.')
      }
    }
  }, [
    account,
    folderName,
    loadImage,
    loadLegacyMemories,
    loadMemories,
    replaceMemories,
    selectedMonth,
    setUploadError,
  ])

  useEffect(() => {
    const lifecycle = { isActive: true }

    queueMicrotask(() => {
      void loadSelectedMonth(lifecycle)
    })

    return () => {
      lifecycle.isActive = false
    }
  }, [loadSelectedMonth])

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image'
    const image = URL.createObjectURL(selectedFile)
    updateDraft({
      fileName: selectedFile.name,
      image,
      imageFile: selectedFile,
      mediaType,
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!oneDrive.account) {
      showUserAlert('Connect OneDrive in Settings before saving.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    const validationMessage = getDraftValidationMessage(draft)

    if (validationMessage) {
      showUserAlert(validationMessage, setAlbumStatus)
      return
    }

    setIsSaving(true)
    setUploadProgress(0)
    const postMonth = getMonthInputValue(draft.date)
    setAlbumStatus(`Saving to ${formatMonthLabel(postMonth)}...`)
    let pendingPost: MemoryPost | null = null
    let pendingPosts: MemoryPost[] = []

    try {
      const uploadedItem = draft.imageFile
        ? await oneDrive.uploadImage(draft.imageFile, draft.mediaType, setUploadProgress)
        : undefined
      pendingPost = {
        id: createMemoryId(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        place: draft.place.trim() || 'No place set',
        date: draft.date,
        image: draft.image,
        mediaType: draft.mediaType,
        driveItemId: uploadedItem?.id,
        driveUrl: uploadedItem?.webUrl,
        imageName: uploadedItem?.name,
        mediaName: uploadedItem?.name,
        fileSize: draft.imageFile?.size,
        syncStatus: 'synced',
        createdAt: new Date().toISOString(),
      }
      const monthPosts =
        postMonth === selectedMonth
          ? memories.posts
          : ((await oneDrive.loadMemories(postMonth)) ?? [])
      pendingPosts = [pendingPost, ...monthPosts]

      await oneDrive.saveMemories(pendingPosts, postMonth)

      if (postMonth === selectedMonth) {
        memories.replaceMemories(pendingPosts)
      } else {
        setSelectedMonth(postMonth)
      }

      setDraft({ ...emptyDraft, date: getTodayInputValue() })
      setAlbumStatus(`Saved to ${formatMonthLabel(postMonth)}.`)
    } catch (error) {
      console.error('Memory save failed', error)
      oneDrive.setUploadError()

      if (pendingPost) {
        if (postMonth !== selectedMonth) {
          showUserAlert(
            `Media uploaded, but the ${formatMonthLabel(postMonth)} memory record was not saved. ${getErrorMessage(error)}`,
            setAlbumStatus,
          )
          return
        }

        const failedPosts = updateMemorySyncState(pendingPosts, pendingPost.id, {
          syncStatus: 'failed',
          syncError: getErrorMessage(error),
        })
        memories.replaceMemories(failedPosts)
        showUserAlert(
          `Media uploaded, but the memory record was not saved. ${getErrorMessage(error)}`,
          setAlbumStatus,
        )
        return
      }

      showUserAlert(`Save failed. ${getErrorMessage(error)}`, setAlbumStatus)
    } finally {
      setIsSaving(false)
      setUploadProgress(null)
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
      await oneDrive.saveMemories(nextPosts, selectedMonth)
      setAlbumStatus('Memory deleted.')
    } catch (error) {
      console.error('Memory delete failed', error)
      oneDrive.setUploadError()
      showUserAlert(`Delete failed. ${getErrorMessage(error)}`, setAlbumStatus)
    }
  }

  const handleRetrySync = async (id: string) => {
    if (!oneDrive.account) {
      showUserAlert('Connect OneDrive in Settings before retrying sync.', setAlbumStatus)
      setActiveView('settings')
      return
    }

    const post = memories.posts.find((memory) => memory.id === id)

    if (!post) {
      return
    }

    const syncingPosts = updateMemorySyncState(memories.posts, id, {
      syncStatus: 'syncing',
      syncError: undefined,
    })
    memories.replaceMemories(syncingPosts)
    setAlbumStatus('Retrying memory sync...')

    try {
      const syncedPosts = updateMemorySyncState(syncingPosts, id, {
        syncStatus: 'synced',
        syncError: undefined,
      })
      await oneDrive.saveMemories(syncedPosts, selectedMonth)
      memories.replaceMemories(syncedPosts)
      setAlbumStatus('Memory synced to OneDrive.')
    } catch (error) {
      console.error('Memory retry sync failed', error)
      oneDrive.setUploadError()
      const failedPosts = updateMemorySyncState(syncingPosts, id, {
        syncStatus: 'failed',
        syncError: getErrorMessage(error),
      })
      memories.replaceMemories(failedPosts)
      showUserAlert(`Retry failed. ${getErrorMessage(error)}`, setAlbumStatus)
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
          <section className="month-toolbar" aria-label="Month filter">
            <div>
              <p className="eyebrow">Viewing</p>
              <h2>{formatMonthLabel(selectedMonth)}</h2>
            </div>
            <label>
              <span>Month</span>
              <input
                onChange={(event) => {
                  if (event.target.value) {
                    setSelectedMonth(event.target.value)
                  }
                }}
                type="month"
                value={selectedMonth}
              />
            </label>
          </section>

          <StatsGrid
            mediaCount={memories.posts.filter((post) => post.image).length}
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
                uploadProgress={uploadProgress}
              />
            </aside>

            <MemoryTimeline
              folderName={oneDrive.folderName}
              isConnected={Boolean(oneDrive.account)}
              onDelete={handleDeleteMemory}
              onQueryChange={memories.setQuery}
              onRetrySync={handleRetrySync}
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
              <p>Go to Album, choose a month, add a photo or video, title, note, place, and date, then save.</p>
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.length > 180 ? `${error.message.slice(0, 180)}...` : error.message
  }

  return 'Check your OneDrive connection and try again.'
}

function getDraftValidationMessage(draft: MemoryDraft) {
  if (!draft.title.trim()) {
    return 'Add a title before saving.'
  }

  if (!draft.body.trim()) {
    return 'Add a note before saving.'
  }

  if (!draft.image) {
    return 'Select a photo or video before saving.'
  }

  return ''
}

function showUserAlert(message: string, setStatus: (message: string) => void) {
  setStatus(message)
  window.alert(message)
}

function updateMemorySyncState(
  posts: MemoryPost[],
  id: string,
  nextState: Pick<MemoryPost, 'syncStatus' | 'syncError'>,
) {
  return posts.map((post) => (post.id === id ? { ...post, ...nextState } : post))
}

function createMemoryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20,
    )}-${hex.slice(20)}`
  }

  return `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

