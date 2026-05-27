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
const defaultOneDriveFolder =
  sanitizeOneDriveFolderName(import.meta.env.VITE_ONEDRIVE_FOLDER as string | undefined) ?? 'Post'

export const oneDriveScopes = ['User.Read', 'Files.ReadWrite']

export const msalInstance = clientId
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: {
        cacheLocation: 'sessionStorage',
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

type OneDriveListResponse = {
  value: Array<{
    name: string
    folder?: unknown
  }>
}

const memoryCloudJsonFile = 'memories.json'

export function getDefaultOneDriveFolder() {
  return defaultOneDriveFolder
}

export function isOneDriveConfigured() {
  return Boolean(msalInstance)
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

export async function uploadImageToOneDrive(file: File, account: AccountInfo, folderName: string) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const extension = getFileExtension(file.name)
  const safeName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(file.name)}${extension}`
  const uploadPath = `/me/drive/root:/${toOneDrivePath(oneDriveFolder, safeName)}:/content`

  await ensureMemoryCloudFolder(accessToken, oneDriveFolder)

  const response = await fetch(`https://graph.microsoft.com/v1.0${uploadPath}`, {
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

  return (await response.json()) as OneDriveUploadResult
}

export async function loadMemoriesFromOneDrive(account: AccountInfo, folderName: string) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${toOneDrivePath(
      oneDriveFolder,
      memoryCloudJsonFile,
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
  }))
}

export async function saveMemoriesToOneDrive(
  posts: MemoryPost[],
  account: AccountInfo,
  folderName: string,
) {
  const accessToken = await getAccessToken(account)
  const oneDriveFolder = getOneDriveFolder(folderName)
  const uploadPath = `/me/drive/root:/${toOneDrivePath(oneDriveFolder, memoryCloudJsonFile)}:/content`
  const cloudPosts = posts.map(toCloudMemoryPost)

  await ensureMemoryCloudFolder(accessToken, oneDriveFolder)

  const response = await fetch(`https://graph.microsoft.com/v1.0${uploadPath}`, {
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
  const folderResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(oneDriveFolder)}:`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (folderResponse.ok) {
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
}

function getFileExtension(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? ''
  return extension.toLowerCase()
}

function sanitizeOneDriveFolderName(value: string | undefined) {
  const folderName = value?.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/^-+|-+$/g, '')

  return folderName || undefined
}

function getOneDriveFolder(value: string) {
  return sanitizeOneDriveFolderName(value) ?? defaultOneDriveFolder
}

function toOneDrivePath(...segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

function toCloudMemoryPost(post: MemoryPost) {
  return {
    ...post,
    image: isRuntimeImageUrl(post.image) ? '' : post.image,
  }
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
