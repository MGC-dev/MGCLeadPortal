// Uploaded files only exist in memory for the current session (the mock backend stores their details, not the bytes).
// With a real backend, `rememberFile` becomes an upload and `fileUrl` returns the download link.
const urls = new Map<string, string>()
export const rememberFile = (docId: string, file: File) => { urls.set(docId, URL.createObjectURL(file)) }
export const fileUrl = (docId: string): string | undefined => urls.get(docId)

export const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
