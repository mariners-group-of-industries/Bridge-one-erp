// Global test setup — runs inside each worker after the runner is initialized.
// vi.mock calls belong in individual test files, not here.

// Tests never upload to a real storage service (e.g. Cloudinary from .env).
process.env.STORAGE_DRIVER = "local";
