import { useCallback } from 'react'
import ProfileForm from './components/ProfileForm'
import { useProfile } from './hooks/useProfile'

export default function App() {
  const { profile, loading, saveProfile } = useProfile()

  const handleAnalyze = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_ANALYSIS' })
    console.log('[CivicEstate] TRIGGER_ANALYSIS sent, closing popup')
    window.close()
  }, [])

  if (loading) return null

  return (
    <ProfileForm
      initialProfile={profile ?? undefined}
      onSave={saveProfile}
      onAnalyze={handleAnalyze}
    />
  )
}
