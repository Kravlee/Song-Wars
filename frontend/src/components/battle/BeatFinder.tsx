'use client'

import { useState, useCallback } from 'react'
import { api, YouTubeVideo } from '@/lib/api'
import Button from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

const GENRES = [
  'Drake', 'Kendrick Lamar', 'Travis Scott', 'J. Cole', 'Future',
  'Lil Baby', 'Playboi Carti', 'Yeat', 'Lil Uzi Vert', 'Metro Boomin',
  'The Weeknd', 'Post Malone', 'Juice WRLD', 'XXXTentacion', 'Ski Mask',
]

interface BeatFinderProps {
  onBeatSelected: (beat: YouTubeVideo) => void
  onClose: () => void
}

export default function BeatFinder({ onBeatSelected, onClose }: BeatFinderProps) {
  const [selectedGenre, setSelectedGenre] = useState('')
  const [results, setResults] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleRandom = async () => {
    setLoading(true)
    try {
      const beat = await api.beats.random()
      onBeatSelected(beat)
      showToast('Beat selected!', 'success')
      onClose()
    } catch (err) {
      showToast('Failed to find random beat', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!selectedGenre) {
      showToast('Please select a genre', 'error')
      return
    }

    setSearching(true)
    try {
      const response = await api.beats.search(`${selectedGenre} type beat free for profit`)
      setResults(response.videos)
    } catch (err) {
      showToast('Failed to search beats', 'error')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white">Find a Beat</h2>
            <p className="text-gray-400 text-sm mt-0.5">Select a genre or go random</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {results.length === 0 ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Pick a Genre</label>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={[
                      'py-2.5 rounded-xl border text-center text-sm font-semibold transition-all',
                      selectedGenre === genre
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                    ].join(' ')}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleRandom}
                loading={loading}
              >
                🎲 Random Beat
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSearch}
                loading={searching}
                disabled={!selectedGenre}
              >
                Search
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((beat) => (
              <button
                key={beat.id}
                onClick={() => {
                  onBeatSelected(beat)
                  onClose()
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl p-4 text-left transition-all"
              >
                <div className="flex gap-3">
                  {beat.thumbnail && (
                    <img
                      src={beat.thumbnail}
                      alt={beat.title}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{beat.title}</p>
                    <p className="text-gray-400 text-xs mt-1">{beat.duration}</p>
                  </div>
                  <div className="text-purple-400 text-xl flex-shrink-0">→</div>
                </div>
              </button>
            ))}
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setResults([])}
            >
              ← Back to Search
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
