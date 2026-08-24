// Test-only import preload. Firestore construction is lazy with respect to
// network access, and suites that exercise data services replace db with fakes.
process.env.FIRESTORE_PROJECT_ID ||= 'test-project'
process.env.MEDIA_BUCKET_NAME ||= 'test-media-bucket'
process.env.SESSION_SECRET ||= 'test-session-secret'
process.env.GOOGLE_OAUTH_CLIENT_ID ||= 'test-google-client-id'
process.env.GOOGLE_OAUTH_CLIENT_SECRET ||= 'test-google-client-secret'
process.env.SERVER_DOMAIN ||= 'http://localhost:8080'
process.env.CLIENT_DOMAIN ||= 'http://localhost:3000'
process.env.PORTAL_DOMAIN ||= 'http://localhost:3001'
process.env.SITE_RENDERER_DOMAIN ||= 'http://localhost:3002'
