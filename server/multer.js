import multer from 'multer'

// Use memory instead of disk
const storage = multer.memoryStorage()
const multipart = multer({ storage })

export default multipart

// Voice-sample uploads (Account -> ElevenLabs). Samples are held in memory only
// for the length of the request, so every limit here is also a memory bound.
const MIB = 1024 * 1024
export const VOICE_UPLOAD_LIMITS = Object.freeze({
  files: 3,
  fileSize: 10 * MIB,
  fields: 6,
  fieldSize: 2 * 1024
})
export const VOICE_UPLOAD_TOTAL_BYTES = 25 * MIB

// Allowlist of sample types, matched after stripping any `;codecs=...` suffix.
// Chrome records WebM/Opus and Safari MP4/AAC, so both are included.
export const VOICE_AUDIO_TYPES = Object.freeze({
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac'
})

export const voiceMimeType = (mimetype) => String(mimetype || '').split(';')[0].trim().toLowerCase()

const voiceUploader = multer({
  storage,
  limits: VOICE_UPLOAD_LIMITS,
  fileFilter: (req, file, callback) => {
    if (Object.hasOwn(VOICE_AUDIO_TYPES, voiceMimeType(file.mimetype))) return callback(null, true)
    callback(Object.assign(new Error('Invalid voice sample type'), { voiceUploadStatus: 400, voiceUploadField: 'files' }))
  }
}).array('files', VOICE_UPLOAD_LIMITS.files)

// Maps every multer failure to a fixed { status, error, field } response.
// Nothing from the upload (names, types, sizes) is echoed back or logged.
const voiceUploadFailure = (error) => {
  if (error.voiceUploadStatus) return { status: error.voiceUploadStatus, body: { error: 'Invalid voice', field: error.voiceUploadField } }
  if (error.code === 'LIMIT_FILE_SIZE') return { status: 413, body: { error: 'Samples are too large', field: 'files' } }
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') return { status: 400, body: { error: 'Invalid voice', field: 'files' } }
  if (error.code === 'LIMIT_FIELD_VALUE') return { status: 400, body: { error: 'Invalid voice', field: error.field === 'description' ? 'description' : 'name' } }
  return { status: 400, body: { error: 'Invalid voice', field: 'name' } }
}

export const voiceUpload = (req, res, next) => {
  voiceUploader(req, res, (error) => {
    if (error) {
      const { status, body } = voiceUploadFailure(error)
      return res.status(status).json(body)
    }
    const total = (req.files || []).reduce((sum, file) => sum + file.size, 0)
    if (total > VOICE_UPLOAD_TOTAL_BYTES) return res.status(413).json({ error: 'Samples are too large', field: 'files' })
    next()
  })
}
