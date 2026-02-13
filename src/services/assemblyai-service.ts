import { existsSync, readFileSync, statSync } from "node:fs"
import { request } from "undici"
import { config } from "../config"
import logger from "../logger"

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
      console.log("📚 Reading file as binary...")
      const audioData = readFileSync(filePath)
      console.log(`🚀 Uploading ${audioData.length} bytes...`)

      // Upload raw bytes using undici
      const { statusCode, body } = await request(`${this.baseUrl}/upload`, {
        method: "POST",
        headers: {
          authorization: this.apiKey,
        },
        body: audioData,
      })

      if (statusCode !== 200) {
        throw new Error(`Upload failed: HTTP ${statusCode}`)
      }

      // Parse response
      const chunks = []
      for await (const chunk of body) {
        chunks.push(chunk)
      }
      const responseData = JSON.parse(Buffer.concat(chunks).toString())

      console.log(`✅ Upload successful: ${responseData.upload_url}`)
      return responseData.upload_url
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
      const requestBody = JSON.stringify({
        audio_url: audioUrl,
        language_detection: true, // Auto-detect language
      })

      const { statusCode, body } = await request(`${this.baseUrl}/transcript`, {
        method: "POST",
        headers: {
          authorization: this.apiKey,
          "content-type": "application/json",
        },
        body: requestBody,
      })

      if (statusCode !== 200) {
        throw new Error(`Create transcription failed: HTTP ${statusCode}`)
      }

      const chunks = []
      for await (const chunk of body) {
        chunks.push(chunk)
      }
      const responseData = JSON.parse(Buffer.concat(chunks).toString())

      return responseData.id
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
        const { statusCode, body } = await request(
          `${this.baseUrl}/transcript/${transcriptionId}`,
          {
            method: "GET",
            headers: {
              authorization: this.apiKey,
            },
          }
        )

        if (statusCode !== 200) {
          throw new Error(`Poll transcription failed: HTTP ${statusCode}`)
        }

        const chunks = []
        for await (const chunk of body) {
          chunks.push(chunk)
        }
        const result = JSON.parse(Buffer.concat(chunks).toString())

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
if (config.LOG_BOOT_DETAIL) {
  if (assemblyAIService.isAvailable()) {
    logger.info("✅ AssemblyAI service configured")
  } else {
    logger.warn(
      "⚠️ AssemblyAI not configured. Set ASSEMBLYAI_API_KEY to enable voice transcription."
    )
  }
}
