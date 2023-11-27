import multer from 'multer'

// Use memory instead of disk
const storage = multer.memoryStorage()
const multipart = multer({ storage })

export default multipart
