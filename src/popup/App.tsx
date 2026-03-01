import { useState } from 'react'
import ProfileForm from './components/ProfileForm'
import { useProfile } from './hooks/useProfile'

type View = 'profile' | 'results'

export default function App() {
  const [view, setView] = useState<View>('profile')
  const { profile, loading, saveProfile } = useProfile()

  if (loading) return null

  if (view === 'results') {
    return <div>Results view coming in Phase 4</div>
  }

  return (
    <ProfileForm
      initialProfile={profile ?? undefined}
      onSave={saveProfile}
      onAnalyze={() => {
        chrome.runtime.sendMessage({ type: 'TRIGGER_ANALYSIS' })
        console.log('[CivicEstate] TRIGGER_ANALYSIS sent, switching to Results view')
        setView('results')
      }}
    />
  )
}
