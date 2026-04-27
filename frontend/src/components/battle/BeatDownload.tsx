'use client'

import { YouTubeVideo } from '@/lib/api'
import Button from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface BeatDownloadProps {
  beat: YouTubeVideo
}

export default function BeatDownload({ beat }: BeatDownloadProps) {
  const handleDownload = async () => {
    try {
      await navigator.clipboard.writeText(beat.url)
      showToast('YouTube link copied to clipboard!', 'success')
      window.open('https://ytmp3.nexus/poMs/', '_blank')
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="font-bold text-white mb-3">🎵 Battle Beat</h3>
      <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
        <p className="text-gray-400 text-xs mb-1">Now Playing</p>
        <p className="text-white font-semibold truncate">{beat.title}</p>
        <a
          href={beat.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 text-xs hover:text-purple-300 mt-2 inline-block"
        >
          Open on YouTube →
        </a>
      </div>
      <Button variant="secondary" fullWidth onClick={handleDownload}>
        📥 Download Beat
      </Button>
    </div>
  )
}
