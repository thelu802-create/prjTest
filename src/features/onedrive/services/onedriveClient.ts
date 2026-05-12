import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MS_CLIENT_ID as string | undefined
const authority =
  (import.meta.env.VITE_MS_AUTHORITY as string | undefined) ??
  'https://login.microsoftonline.com/consumers'

export const oneDriveScopes = ['User.Read', 'Files.ReadWrite']

export const msalInstance = clientId
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri: window.location.origin + window.location.pathname,
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

export async function uploadImageToOneDrive(file: File, account: AccountInfo) {
  const accessToken = await getAccessToken(account)
  const extension = getFileExtension(file.name)
  const safeName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(file.name)}${extension}`
  const uploadPath = `/me/drive/root:/MemoryCloud/${safeName}:/content`

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

function getFileExtension(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? ''
  return extension.toLowerCase()
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
