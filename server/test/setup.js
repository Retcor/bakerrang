// Test-only import preload. Firestore construction is lazy with respect to
// network access, and suites that exercise data services replace db with fakes.
process.env.FIRESTORE_PROJECT_ID ||= 'test-project'
