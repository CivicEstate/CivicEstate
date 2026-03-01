import { useState } from 'react'
import ProfileForm from './components/ProfileForm'

type View = 'profile' | 'results'

export default function App() {
  const [view, setView] = useState<View>('profile')

  if (view === 'results') {
    console.log('[CivicEstate] Results view — built in Phase 4')
    return <div>Results view coming in Phase 4</div>
  }

  return (
    <ProfileForm
      onAnalyze={() => {
        console.log('[CivicEstate] switching to Results view')
        setView('results')
      }}
    />
  )
}
