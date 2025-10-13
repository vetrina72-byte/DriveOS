// This is a simple in-memory store.
// In a real-world serverless environment, this is not reliable for scaling.
// A better solution would be Vercel KV, Redis, or a database.
// But for this demo, it will likely work.

const authStore = new Map();

// Periodically clean up old entries to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authStore.entries()) {
        // Remove entries older than 5 minutes
        if (now - value.timestamp > 5 * 60 * 1000) {
            authStore.delete(key);
        }
    }
}, 60 * 1000); // Check every minute

export default authStore;
