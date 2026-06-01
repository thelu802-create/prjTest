import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { MemoryPost } from '../../../shared/types/memory'
import {
  getDefaultOneDriveFolder,
  initializeOneDriveAuth,
  isOneDriveConfigured,
  listOneDriveFolders,
  loadLegacyMemoriesFromOneDrive,
  loadMemoryImageFromOneDrive,
  loadMemoriesFromOneDrive,
  saveMemoriesToOneDrive,
  signInToOneDrive,
  signOutFromOneDrive,
  uploadImageToOneDrive,
} from '../services/onedriveClient'

const FOLDER_SESSION_KEY = 'memory-cloud-folder'

export function useOneDrive() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [folderName, setFolderName] = useState(() => getInitialFolderName())
  const [folderOptions, setFolderOptions] = useState<string[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [syncMessage, setSyncMessage] = useState('Not connected to OneDrive')

  useEffect(() => {
    initializeOneDriveAuth()
      .then((currentAccount) => {
        setAccount(currentAccount)
        setSyncMessage(
          currentAccount ? 'Ready to sync with OneDrive' : 'Not connected to OneDrive',
        )
      })
      .catch(() => {
        setSyncMessage('Could not initialize OneDrive')
      })
      .finally(() => {
        setIsAuthReady(true)
      })
  }, [])

  useEffect(() => {
    sessionStorage.setItem(FOLDER_SESSION_KEY, folderName)
  }, [folderName])

  useEffect(() => {
    if (!account) {
      return
    }

    refreshFolders()
  }, [account])

  const signIn = async () => {
    try {
      setSyncMessage('Redirecting to Microsoft...')
      await signInToOneDrive()
    } catch {
      setSyncMessage('OneDrive sign-in failed')
    }
  }

  const signOut = async () => {
    setSyncMessage('Signing out of OneDrive...')
    await signOutFromOneDrive(account)
  }

  const uploadImage = async (
    file: File,
    mediaType: 'image' | 'video',
    onProgress?: (progress: number) => void,
  ) => {
    if (!account) {
      return undefined
    }

    setSyncMessage(`Uploading ${mediaType} to OneDrive...`)
    const uploadedItem = await uploadImageToOneDrive(
      file,
      account,
      folderName,
      mediaType,
      onProgress,
    )
    setSyncMessage(`${mediaType === 'video' ? 'Video' : 'Image'} uploaded to OneDrive`)

    return uploadedItem
  }

  const loadImage = async (itemId: string) => {
    if (!account) {
      return ''
    }

    return loadMemoryImageFromOneDrive(itemId, account)
  }

  const loadMemories = async (monthKey: string) => {
    if (!account) {
      return null
    }

    setSyncMessage('Loading memories from OneDrive...')
    const cloudPosts = await loadMemoriesFromOneDrive(account, folderName, monthKey)
    setSyncMessage(
      cloudPosts ? 'Memories loaded from OneDrive' : 'No monthly memories file in this folder',
    )

    return cloudPosts
  }

  const saveMemories = async (posts: MemoryPost[], monthKey: string) => {
    if (!account) {
      return false
    }

    setSyncMessage('Saving memories to OneDrive...')
    await saveMemoriesToOneDrive(posts, account, folderName, monthKey)
    setSyncMessage('Memories saved to OneDrive')

    return true
  }

  const loadLegacyMemories = async () => {
    if (!account) {
      return null
    }

    return loadLegacyMemoriesFromOneDrive(account, folderName)
  }

  const refreshFolders = async () => {
    if (!account) {
      return
    }

    setIsLoadingFolders(true)

    try {
      const nextFolders = await listOneDriveFolders(account)
      setFolderOptions(nextFolders)
    } catch {
      setSyncMessage('Could not load OneDrive folders')
    } finally {
      setIsLoadingFolders(false)
    }
  }

  const changeFolder = (nextFolderName: string) => {
    const sanitizedFolderName = sanitizeFolderName(nextFolderName)

    if (!sanitizedFolderName) {
      return
    }

    setFolderName(sanitizedFolderName)
    setSyncMessage(`Using folder ${sanitizedFolderName}`)
  }

  const setUploadError = () => {
    setSyncMessage('OneDrive sync failed')
  }

  return {
    account,
    changeFolder,
    folderName,
    folderOptions,
    isAuthReady,
    isConfigured: isOneDriveConfigured(),
    isLoadingFolders,
    loadImage,
    loadLegacyMemories,
    loadMemories,
    refreshFolders,
    saveMemories,
    setUploadError,
    signIn,
    signOut,
    syncMessage,
    uploadImage,
  }
}

function getInitialFolderName() {
  return sanitizeFolderName(sessionStorage.getItem(FOLDER_SESSION_KEY) ?? undefined) ?? getDefaultOneDriveFolder()
}

function sanitizeFolderName(value: string | null | undefined) {
  const folderName = value?.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/^-+|-+$/g, '')

  return folderName || undefined
}
