import axios from "axios"
import { readFileSync, existsSync, statSync } from "fs"

interface AssemblyAIConfig {
  apiKey: string
}

interface TranscriptionResult {
  id: string
  status: "queued" | "processing" | "completed" | "error"
  text?: string
  error?: string
}

export class AssemblyAIService {
  private apiKey: string
  private baseUrl = "https://api.assemblyai.com/v2"

  constructor(config: AssemblyAIConfig) {
    this.apiKey = config.apiKey
  }

  // Check if service is configured
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== "YOUR_ASSEMBLYAI_API_KEY"
  }

  // Upload audio file to AssemblyAI
  private async uploadFile(filePath: string): Promise<string> {
    try {

      // Check file exists and get size
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      const stats = statSync(filePath)
      const fileSizeKB = (stats.size / 1024).toFixed(2)
      console.log(`📎 Uploading file: ${filePath} (${fileSizeKB} KB)`)

      if (stats.size === 0) {
        throw new Error("File is empty (0 bytes)")
      }

      // Read file as raw binary data (Buffer)
      // AssemblyAI requires binary upload, NOT FormData!
      console.log(`📚 Reading file as binary...`)
      const audioData = readFileSync(filePath)
      console.log(`🚀 Uploading ${audioData.length} bytes...`)

      // Upload raw bytes (like official example)
      const response = await axios.post(`${this.baseUrl}/upload`, audioData, {
        headers: {
          authorization: this.apiKey,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })

      console.log(`✅ Upload successful: ${response.data.upload_url}`)
      return response.data.upload_url
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("❌ AssemblyAI upload error:", error.message)
      if (error.response) {
        console.error("Response status:", error.response.status)
        console.error("Response ", error.response.data)
      }
      throw new Error("Failed to upload audio file")
    }
  }

  // Create transcription job
  private async createTranscription(audioUrl: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transcript`,
        {
          audio_url: audioUrl,
          language_detection: true, // Auto-detect language
        },
        {
          headers: {
            authorization: this.apiKey,
            "content-type": "application/json",
          },
        }
      )

      return response.data.id
    } catch (error) {
      console.error("AssemblyAI transcription error:", error)
      throw new Error("Failed to create transcription")
    }
  }

  // Poll for transcription result
  private async pollTranscription(
    transcriptionId: string
  ): Promise<TranscriptionResult> {
    const maxAttempts = 60 // 60 attempts
    const pollInterval = 1000 // 1 second

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/transcript/${transcriptionId}`,
          {
            headers: {
              authorization: this.apiKey,
            },
          }
        )

        const result = response.data

        if (result.status === "completed") {
          return {
            id: result.id,
            status: "completed",
            text: result.text,
          }
        }

        if (result.status === "error") {
          return {
            id: result.id,
            status: "error",
            error: result.error,
          }
        }

        // Still processing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      } catch (error) {
        console.error("AssemblyAI polling error:", error)
        throw new Error("Failed to poll transcription status")
      }
    }

    throw new Error("Transcription timeout")
  }

  // Main method: transcribe audio file
  async transcribeFile(filePath: string): Promise<string | null> {
    if (!this.isAvailable()) {
      console.log(
        "⚠️ AssemblyAI not configured. Set ASSEMBLYAI_API_KEY in environment."
      )
      return null
    }

    try {
      console.log("🎤 Uploading audio to AssemblyAI...")
      const audioUrl = await this.uploadFile(filePath)

      console.log("🎤 Creating transcription job...")
      const transcriptionId = await this.createTranscription(audioUrl)

      console.log("🎤 Waiting for transcription...")
      const result = await this.pollTranscription(transcriptionId)

      if (result.status === "completed" && result.text) {
        console.log("✅ AssemblyAI transcription:", result.text)
        return result.text
      }

      if (result.status === "error") {
        console.error("❌ AssemblyAI error:", result.error)
        return null
      }

      return null
    } catch (error) {
      console.error("AssemblyAI transcription failed:", error)
      return null
    }
  }

  // Get API info
  getInfo(): { configured: boolean; baseUrl: string } {
    return {
      configured: this.isAvailable(),
      baseUrl: this.baseUrl,
    }
  }
}

// Create singleton instance
// API key from environment variable or config
const apiKey = process.env.ASSEMBLYAI_API_KEY || "YOUR_ASSEMBLYAI_API_KEY"

export const assemblyAIService = new AssemblyAIService({ apiKey })

// Log status on import
if (assemblyAIService.isAvailable()) {
  console.log("✅ AssemblyAI service configured")
} else {
  console.warn(
    "⚠️ AssemblyAI not configured. Set ASSEMBLYAI_API_KEY to enable voice transcription."
  )
}
