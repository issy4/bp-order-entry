/**
 * Sanitize string for safe storage path
 * Allow only: a-z A-Z 0-9 _ -
 */
export function sanitizeForStorage(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")          // スペース → _
    .replace(/[^\w\-]/g, "_")      // 英数字 _ - 以外を _
}

/**
 * Generate file path for Supabase Storage
 * Format:
 * {project_code}/{timestamp}_{filename}
 */
export function generateFilePath(
  projectCode: string,
  projectName: string,
  originalFilename: string
): string {

  const safeProjectCode = sanitizeForStorage(projectCode)

  // ファイル名処理
  const extension = originalFilename.split(".").pop() || ""

  const baseName = originalFilename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\-]/g, "_")

  const timestamp = Math.floor(Date.now() / 1000)

  const filename = `${timestamp}_${baseName}.${extension}`

  return `${safeProjectCode}/${filename}`
}