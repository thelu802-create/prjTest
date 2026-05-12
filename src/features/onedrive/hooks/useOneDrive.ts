import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import {
  initializeOneDriveAuth,
  isOneDriveConfigured,
  signInToOneDrive,
  signOutFromOneDrive,
  uploadImageToOneDrive,
} from '../services/onedriveClient'

export function useOneDrive() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [syncMessage, setSyncMessage] = useState('Chưa đăng nhập OneDrive')

  useEffect(() => {
    initializeOneDriveAuth()
      .then((currentAccount) => {
        setAccount(currentAccount)
        setSyncMessage(
          currentAccount ? 'Đã sẵn sàng upload lên OneDrive' : 'Chưa đăng nhập OneDrive',
        )
      })
      .catch(() => {
        setSyncMessage('Không thể khởi tạo OneDrive')
      })
      .finally(() => {
        setIsAuthReady(true)
      })
  }, [])

  const signIn = async () => {
    try {
      setSyncMessage('Đang chuyển sang Microsoft...')
      await signInToOneDrive()
    } catch {
      setSyncMessage('Đăng nhập OneDrive không thành công')
    }
  }

  const signOut = async () => {
    setSyncMessage('Đang đăng xuất OneDrive...')
    await signOutFromOneDrive(account)
  }

  const uploadImage = async (file: File) => {
    if (!account) {
      return undefined
    }

    setSyncMessage('Đang upload ảnh lên OneDrive...')
    const uploadedItem = await uploadImageToOneDrive(file, account)
    setSyncMessage('Đã upload ảnh lên OneDrive')

    return uploadedItem.webUrl
  }

  const setUploadError = () => {
    setSyncMessage('Upload OneDrive lỗi, ảnh chưa được lưu lên cloud')
  }

  return {
    account,
    isAuthReady,
    isConfigured: isOneDriveConfigured(),
    setUploadError,
    signIn,
    signOut,
    syncMessage,
    uploadImage,
  }
}
