import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser'
import type { MemoryPost } from '../../../shared/types/memory'

const clientId = import.meta.env.VITE_MS_CLIENT_ID as string | undefined
const authority =
  (import.meta.env.VITE_MS_AUTHORITY as string | undefined) ??
  'https://login.microsoftonline.com/consumers'
const configuredRedirectUri = import.meta.env.VITE_MS_REDIRECT_URI as string | undefined
const redirectUri = configuredRedirectUri ?? window.location.origin + window.location.pathname
const defaultOneDriveFolder =
  sanitizeOneDriveFolderName(import.meta.env.VITE_ONEDRIVE_FOLDER as string | undefined) ?? 'Post'

export const oneDriveScopes = ['User.Read', 'Files.ReadWrite']

export const msalInstance = clientId
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    })
  : null

export type OneDriveUploadResult = {
  id: string
  name: string
  webUrl: string
}

type OneDriveDownloadItem = {
  '@microsoft.graph.downloadUrl'?: string
}

type OneDriveThumbnailResponse = {
  url?: string
}

type OneDriveListResponse = {
  value: Array<{
    name: string
    folder?: unknown
  }>
}

const imageFolder = 'images'
const videoFolder = 'videos'
const jsonFolder = 'json'
const legacyMemoryCloudJsonFile = 'memories.json'
const ensuredFolderPaths = new Set<string>()
const simpleUploadLimitBytes = 4 * 1024 * 1024
const uploadChunkSize = 10 * 1024 * 1024

export function getDefaultOneDriveFolder() {
  return defaultOneDriveFolder
}

export function isOneDriveConfigured() {
  return Boolean(msalInstance)
}

export function getOneDriveRedirectUri() {
  return redirectUri
}

export async function initializeOneDriveAuth() {
  if (!msalInstance) {
    return null
  }

  await msalInstance.initialize()
  const response = await msalInstance.handleRedirectPromise({
    navigateToLoginRequestUrl: false,
  })

  if (response?.account) {
    msalInstance.setActiveAccount(response.account)
    return response.account
  }

  const currentAccount = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]

  if (currentAccount) {
    msalInstance.setActiveAccount(currentAccount)
  }

  return currentAccount ?? null
}

export async function signInToOneDrive() {
  if (!msalInstance) {
    throw new Error('Missing VITE_MS_CLIENT_ID')
  }

  await msalInstance.loginRedirect({
    prompt: 'select_account',
    scopes: oneDriveScopes,
  })
}

export async function signOutFromOneDrive(account: AccountInfo | null) {
  if (!msalInstance || !account) {
    return
  }

  await msalInstance.logoutRedirect({
    account,
    postLogoutRedirectUri: window.location.origin + window.location.pathname,
  })
}

export async function uploadImageToOneDrive(
  file: File,
  account: AccountInfo,
  folderName: string,
  mediaType: 'image' | 'video' = getMediaType(file),
  onProgress?: (progress: number) => void,
) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const mediaFolder = mediaType === 'video' ? videoFolder : imageFolder
  const extension = getFileExtension(file.name)
  const safeName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(file.name)}${extension}`
  const uploadPath = `/me/drive/root:/${toOneDrivePath(oneDriveFolder, mediaFolder, safeName)}:/content`

  await ensureMemoryCloudFolder(accessToken, oneDriveFolder)
  await ensureNestedFolder(accessToken, oneDriveFolder, mediaFolder)

  if (file.size > simpleUploadLimitBytes) {
    return uploadLargeFileToOneDrive(file, accessToken, uploadPath, onProgress)
  }

  const response = await fetchWithRetry(`https://graph.microsoft.com/v1.0${uploadPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive upload failed')
  }

  onProgress?.(100)

  return (await response.json()) as OneDriveUploadResult
}

async function uploadLargeFileToOneDrive(
  file: File,
  accessToken: string,
  uploadPath: string,
  onProgress?: (progress: number) => void,
) {
  const sessionResponse = await fetchWithRetry(
    `https://graph.microsoft.com/v1.0${uploadPath.replace(/:\/content$/, ':/createUploadSession')}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
        },
      }),
    },
  )

  if (!sessionResponse.ok) {
    const message = await sessionResponse.text()
    throw new Error(message || 'OneDrive upload session failed')
  }

  const { uploadUrl } = (await sessionResponse.json()) as { uploadUrl: string }
  let uploadedBytes = 0

  while (uploadedBytes < file.size) {
    const nextUploadedBytes = Math.min(uploadedBytes + uploadChunkSize, file.size)
    const chunk = file.slice(uploadedBytes, nextUploadedBytes)
    const chunkResponse = await fetchWithRetry(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${uploadedBytes}-${nextUploadedBytes - 1}/${file.size}`,
      },
      body: chunk,
    })

    if (!chunkResponse.ok && chunkResponse.status !== 202) {
      const message = await chunkResponse.text()
      throw new Error(message || 'OneDrive chunk upload failed')
    }

    uploadedBytes = nextUploadedBytes
    onProgress?.(Math.round((uploadedBytes / file.size) * 100))

    if (chunkResponse.status === 201 || chunkResponse.status === 200) {
      return (await chunkResponse.json()) as OneDriveUploadResult
    }
  }

  throw new Error('OneDrive upload session did not return a drive item')
}

export async function loadMemoriesFromOneDrive(
  account: AccountInfo,
  folderName: string,
  monthKey: string,
) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${toOneDrivePath(
      oneDriveFolder,
      jsonFolder,
      getMonthlyMemoryFileName(monthKey),
    )}:/content`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive memories download failed')
  }

  const posts = (await response.json()) as MemoryPost[]

  return posts.map((post) => ({
    ...post,
    image: isRuntimeImageUrl(post.image) ? '' : post.image,
    syncStatus: 'synced' as const,
    syncError: undefined,
  }))
}

export async function saveMemoriesToOneDrive(
  posts: MemoryPost[],
  account: AccountInfo,
  folderName: string,
  monthKey: string,
) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const uploadPath = `/me/drive/root:/${toOneDrivePath(
    oneDriveFolder,
    jsonFolder,
    getMonthlyMemoryFileName(monthKey),
  )}:/content`
  const cloudPosts = posts.map(toCloudMemoryPost)

  await ensureMemoryCloudFolder(accessToken, oneDriveFolder)
  await ensureNestedFolder(accessToken, oneDriveFolder, jsonFolder)

  const response = await fetchWithRetry(`https://graph.microsoft.com/v1.0${uploadPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cloudPosts, null, 2),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive memories save failed')
  }
}

export async function loadLegacyMemoriesFromOneDrive(account: AccountInfo, folderName: string) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${toOneDrivePath(
      oneDriveFolder,
      legacyMemoryCloudJsonFile,
    )}:/content`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive legacy memories download failed')
  }

  const posts = (await response.json()) as MemoryPost[]

  return posts.map((post) => ({
    ...post,
    image: isRuntimeImageUrl(post.image) ? '' : post.image,
    syncStatus: 'synced' as const,
    syncError: undefined,
  }))
}

export async function listOneDriveFolders(account: AccountInfo) {
  const accessToken = await getAccessToken(account)
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=200', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive folder list failed')
  }

  const result = (await response.json()) as OneDriveListResponse

  return result.value
    .filter((item) => item.folder)
    .map((item) => item.name)
    .sort((first, second) => first.localeCompare(second))
}

export async function loadMemoryImageFromOneDrive(itemId: string, account: AccountInfo) {
  const accessToken = await getAccessToken(account)
  const itemResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!itemResponse.ok) {
    const message = await itemResponse.text()
    throw new Error(message || 'OneDrive image lookup failed')
  }

  const item = (await itemResponse.json()) as OneDriveDownloadItem

  if (!item['@microsoft.graph.downloadUrl']) {
    throw new Error('OneDrive image download URL missing')
  }

  return item['@microsoft.graph.downloadUrl']
}

export async function loadMemoryThumbnailFromOneDrive(itemId: string, account: AccountInfo) {
  const accessToken = await getAccessToken(account)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      itemId,
    )}/thumbnails/0/large`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive thumbnail lookup failed')
  }

  const thumbnail = (await response.json()) as OneDriveThumbnailResponse

  if (!thumbnail.url) {
    throw new Error('OneDrive thumbnail URL missing')
  }

  return thumbnail.url
}

export async function deleteDriveItemFromOneDrive(itemId: string, account: AccountInfo) {
  const accessToken = await getAccessToken(account)
  const response = await fetchWithRetry(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (response.status === 404) {
    return
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'OneDrive media delete failed')
  }
}

async function getAccessToken(account: AccountInfo) {
  if (!msalInstance) {
    throw new Error('Missing VITE_MS_CLIENT_ID')
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      account,
      scopes: oneDriveScopes,
    })

    return response.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup({
        account,
        scopes: oneDriveScopes,
      })

      return response.accessToken
    }

    throw error
  }
}

async function ensureMemoryCloudFolder(accessToken: string, folderName: string) {
  const oneDriveFolder = getOneDriveFolder(folderName)
  const cacheKey = oneDriveFolder

  if (ensuredFolderPaths.has(cacheKey)) {
    return
  }

  const folderResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(oneDriveFolder)}:`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (folderResponse.ok) {
    ensuredFolderPaths.add(cacheKey)
    return
  }

  if (folderResponse.status !== 404) {
    const message = await folderResponse.text()
    throw new Error(message || 'Unable to check OneDrive folder')
  }

  const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: oneDriveFolder,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  })

  if (!createResponse.ok && createResponse.status !== 409) {
    const message = await createResponse.text()
    throw new Error(message || 'Unable to create OneDrive folder')
  }

  ensuredFolderPaths.add(cacheKey)
}

async function ensureNestedFolder(accessToken: string, parentFolderName: string, childFolderName: string) {
  const oneDriveFolder = getOneDriveFolder(parentFolderName)
  const cacheKey = `${oneDriveFolder}/${childFolderName}`

  if (ensuredFolderPaths.has(cacheKey)) {
    return
  }

  const nestedFolderResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${toOneDrivePath(
      oneDriveFolder,
      childFolderName,
    )}:`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (nestedFolderResponse.ok) {
    ensuredFolderPaths.add(cacheKey)
    return
  }

  if (nestedFolderResponse.status !== 404) {
    const message = await nestedFolderResponse.text()
    throw new Error(message || 'Unable to check OneDrive child folder')
  }

  const createResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(oneDriveFolder)}:/children`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: childFolderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    },
  )

  if (!createResponse.ok && createResponse.status !== 409) {
    const message = await createResponse.text()
    throw new Error(message || 'Unable to create OneDrive child folder')
  }

  ensuredFolderPaths.add(cacheKey)
}

function getFileExtension(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? ''
  return extension.toLowerCase()
}

function getMediaType(file: File): 'image' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

function sanitizeOneDriveFolderName(value: string | undefined) {
  const folderName = value?.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/^-+|-+$/g, '')

  return folderName || undefined
}

function getOneDriveFolder(value: string) {
  return sanitizeOneDriveFolderName(value) ?? defaultOneDriveFolder
}

function getMonthlyMemoryFileName(monthKey: string) {
  return `memories-${monthKey}.json`
}

function toOneDrivePath(...segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

function toCloudMemoryPost(post: MemoryPost) {
  const cloudPost = { ...post }

  delete cloudPost.syncStatus
  delete cloudPost.syncError

  return {
    ...cloudPost,
    image: isRuntimeImageUrl(post.image) ? '' : post.image,
    mediaItems: post.mediaItems?.map((media) => {
      const cloudMedia = {
        ...media,
        url: isRuntimeImageUrl(media.url) ? '' : media.url,
      }

      delete cloudMedia.thumbnailUrl

      return cloudMedia
    }),
  }
}

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3) {
  let lastResponse: Response | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResponse = await fetch(url, init)

    if (!shouldRetry(lastResponse.status) || attempt === maxAttempts) {
      return lastResponse
    }

    await delay(500 * attempt)
  }

  return lastResponse as Response
}

function shouldRetry(status: number) {
  return status === 404 || status === 408 || status === 409 || status === 423 || status === 429 || status >= 500
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function isRuntimeImageUrl(value: string) {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.includes('/_layouts/15/download.aspx') ||
    value.includes('download.aspx?UniqueId=')
  )
}

function slugify(value: string) {
  const nameWithoutExtension = value.replace(/\.[a-z0-9]+$/i, '')

  return (
    nameWithoutExtension
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'memory'
  )
}
