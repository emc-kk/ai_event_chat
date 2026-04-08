export interface SpeechRecognitionResult {
  transcript: string
  isFinal: boolean
}

export class SpeechRecognitionService {
  private recognition: any
  private isSupported: boolean

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.isSupported = !!SpeechRecognition

      if (this.isSupported) {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'ja-JP'
      }
    } else {
      this.isSupported = false
    }
  }

  onResult(callback: (result: SpeechRecognitionResult) => void): () => void {
    if (!this.isSupported || !this.recognition) {
      return () => {}
    }

    const handleResult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const transcript = finalTranscript || interimTranscript
      callback({
        transcript,
        isFinal: !!finalTranscript
      })
    }

    this.recognition.addEventListener('result', handleResult)

    return () => {
      this.recognition.removeEventListener('result', handleResult)
    }
  }

  onError(callback: (error: string) => void): () => void {
    if (!this.isSupported || !this.recognition) {
      return () => {}
    }

    const handleError = (event: any) => {
      callback(event.error || 'Unknown error')
    }

    this.recognition.addEventListener('error', handleError)

    return () => {
      this.recognition.removeEventListener('error', handleError)
    }
  }

  onEnd(callback: () => void): () => void {
    if (!this.isSupported || !this.recognition) {
      return () => {}
    }

    this.recognition.addEventListener('end', callback)

    return () => {
      this.recognition.removeEventListener('end', callback)
    }
  }

  start(): void {
    if (this.isSupported && this.recognition) {
      try {
        this.recognition.start()
      } catch (error) {
        console.warn('Speech recognition already started')
      }
    }
  }

  stop(): void {
    if (this.isSupported && this.recognition) {
      this.recognition.stop()
    }
  }

  abort(): void {
    if (this.isSupported && this.recognition) {
      this.recognition.abort()
    }
  }

  isBrowserSupported(): boolean {
    return this.isSupported
  }
}

