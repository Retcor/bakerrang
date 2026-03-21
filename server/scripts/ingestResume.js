/**
 * Resume ingestion script — run once (and re-run whenever you update dan-resume.md)
 *
 * Usage (from the server/ directory):
 *   node scripts/ingestResume.js
 *
 * Prerequisites:
 *   1. CHAT_GPT_API_KEY must be set in .env
 *   2. Firestore credentials must be configured (GOOGLE_APPLICATION_CREDENTIALS or default ADC)
 *   3. Create the Firestore vector index before querying (see README note below)
 *
 * Firestore Vector Index (one-time setup via gcloud CLI):
 *   gcloud firestore indexes composite create \
 *     --collection-group=resume_chunks \
 *     --query-scope=COLLECTION \
 *     --field-config=vector-config='{"dimension":"1536","flat": "{}"}',field-path=embedding
 *
 *   Or visit the GCP Console → Firestore → Indexes → Create composite index with the above settings.
 *   The index takes a few minutes to build. Queries will fail with a helpful error + link until it's ready.
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { storeChunk } from '../services/chatbotService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Splits the markdown knowledge base into logical chunks by section headers.
 * Sections starting with ## become top-level chunks.
 * Subsections (###) within a large block are split as sub-chunks.
 */
const chunkBySection = (text) => {
  const lines = text.split('\n')
  const chunks = []
  let current = []
  let currentHeader = 'General'

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current.length > 0 && current.join('\n').trim().length > 50) {
        chunks.push({ header: currentHeader, content: current.join('\n').trim() })
      }
      currentHeader = line.replace(/^## /, '')
      current = [line]
    } else if (line.startsWith('### ') && current.join('\n').trim().length > 300) {
      // Split large sections at subsections to keep chunks focused
      chunks.push({ header: currentHeader, content: current.join('\n').trim() })
      currentHeader = line.replace(/^### /, '')
      current = [line]
    } else {
      current.push(line)
    }
  }

  if (current.length > 0 && current.join('\n').trim().length > 50) {
    chunks.push({ header: currentHeader, content: current.join('\n').trim() })
  }

  return chunks
}

const main = async () => {
  const resumePath = join(__dirname, '../data/dan-resume.md')
  const text = readFileSync(resumePath, 'utf-8')
  const chunks = chunkBySection(text)

  console.log(`Found ${chunks.length} chunks to ingest:\n`)
  chunks.forEach((c, i) => console.log(`  ${i + 1}. ${c.header} (${c.content.length} chars)`))
  console.log()

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = `chunk_${String(i).padStart(3, '0')}_${chunk.header.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40)}`
    process.stdout.write(`  Embedding [${i + 1}/${chunks.length}] ${chunk.header}... `)
    await storeChunk(id, chunk.content, { header: chunk.header, index: i })
    console.log('done')
  }

  console.log('\nIngestion complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('\nIngestion failed:', err.message)
  process.exit(1)
})
