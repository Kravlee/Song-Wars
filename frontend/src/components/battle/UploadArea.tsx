'use client'

import { useCallback, useRef, useState } from 'react'

interface UploadAreaProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  submitted?: boolean
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave']
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav']

export default function UploadArea({ onFileSelect, disabled = false, submitted = false }: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)

      // Type check
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValidType = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext)
      if (!isValidType) {
        setError('Only .mp3 and .wav files are accepted.')
        return
      }

      // Size check
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is 20MB (got ${(file.size / 1024 / 1024).toFixed(1)}MB).`)
        return
      }

      setSelectedFile(file)
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !submitted) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || submitted) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      validateAndSelect(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      validateAndSelect(files[0])
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleClick = () => {
    if (disabled || submitted) return
    fileInputRef.current?.click()
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="border-2 border-green-500/50 rounded-2xl p-8 bg-green-500/5 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-green-400 font-bold text-lg">Submitted!</p>
          <p className="text-gray-400 text-sm mt-1">Your track has been submitted successfully.</p>
          <p className="text-gray-500 text-xs mt-1">Waiting for other players...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer',
          'flex flex-col items-center gap-3 text-center',
          isDragOver
            ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
            : selectedFile
            ? 'border-blue-500/60 bg-blue-500/5'
            : 'border-gray-600 hover:border-purple-500/50 hover:bg-gray-800/50 bg-gray-800/20',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {selectedFile ? (
          <>
            <div className="w-14 h-14 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{selectedFile.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                File ready
              </span>
              <button
                onClick={clearFile}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors underline"
              >
                Change
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={[
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300',
              isDragOver
                ? 'bg-purple-500/30 scale-110'
                : 'bg-gray-700/50',
            ].join(' ')}>
              <svg
                className={`w-8 h-8 transition-colors duration-300 ${isDragOver ? 'text-purple-400' : 'text-gray-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>

            <div>
              <p className={`font-semibold text-sm transition-colors ${isDragOver ? 'text-purple-300' : 'text-gray-300'}`}>
                {isDragOver ? 'Drop it!' : 'Drop your track here or click to browse'}
              </p>
              <p className="text-gray-500 text-xs mt-1">MP3 or WAV • Max 20MB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-400 text-xs leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  )
}
