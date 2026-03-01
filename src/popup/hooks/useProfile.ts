import { useState, useEffect } from 'react'
import { UserProfile } from '../../types/index'

interface UseProfileReturn {
  profile: UserProfile | null
  loading: boolean
  saveProfile: (profile: UserProfile) => Promise<void>
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.storage.local.get('userProfile', (result) => {
      setProfile(result.userProfile ?? null)
      setLoading(false)
    })
  }, [])

  async function saveProfile(p: UserProfile): Promise<void> {
    await chrome.storage.local.set({ userProfile: p })
    setProfile(p)
    chrome.runtime.sendMessage({ type: 'SAVE_PROFILE', payload: p })
  }

  return { profile, loading, saveProfile }
}
