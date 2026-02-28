import { useState } from 'react'

export default function App() {
  const [response, setResponse] = useState<string | null>(null)

  function handleTest() {
    chrome.runtime.sendMessage({ type: 'popup-ping' }, (res) => {
      setResponse(res?.status ?? 'no response')
    })
  }

  return (
    <div>
      <button onClick={handleTest}>Test background</button>
      {response && <p>{response}</p>}
    </div>
  )
}
