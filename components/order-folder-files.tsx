"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Upload, Download, Trash2, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ja } from "date-fns/locale"

interface OrderEntryFile {
  id: string
  order_entry_id: string
  file_url: string
  file_name: string
  file_size: number
  created_at: string
}

interface OrderFolderFilesProps {
  orderEntryId: string
  orderNumber: string
}

const ALLOWED_EXTENSIONS = ["pdf", "ai", "eps", "zip", "jpg", "jpeg", "png"]
const MAX_FILE_SIZE = 50 * 1024 * 1024

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

function extractStoragePath(fileUrl: string, bucketName: string) {
  try {
    const url = new URL(fileUrl)
    const marker = `/storage/v1/object/public/${bucketName}/`
    const index = url.pathname.indexOf(marker)
    if (index === -1) return null
    return decodeURIComponent(url.pathname.substring(index + marker.length))
  } catch {
    return null
  }
}

export function OrderFolderFiles({
  orderEntryId,
  orderNumber,
}: OrderFolderFilesProps) {
  const [files, setFiles] = useState<OrderEntryFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    fileId: null as string | null,
    fileName: null as string | null,
    fileUrl: null as string | null,
  })
  const [isDragging, setIsDragging] = useState(false)

  const supabase = createClient()
  const bucketName = "order-files"
  const folderPath = `${orderNumber}`

  const fetchFiles = useCallback(async () => {
    setIsLoading(true)

    const { data, error } = await supabase
      .from("order_entry_files")
      .select("*")
      .eq("order_entry_id", orderEntryId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      toast.error("ファイル一覧の取得に失敗しました")
      setIsLoading(false)
      return
    }

    setFiles(data ?? [])
    setIsLoading(false)
  }, [orderEntryId, supabase])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error("ファイル取得に失敗しました")
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error(error)
      toast.error("ダウンロードに失敗しました")
    }
  }

  const validateFiles = (selectedFiles: File[]) => {
    const validFiles: File[] = []

    for (const file of selectedFiles) {
      const extension = getExtension(file.name)

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        toast.error(`${file.name} は許可されていない形式です`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} は容量上限 50MB を超えています`)
        continue
      }

      validFiles.push(file)
    }

    return validFiles
  }

  const uploadFiles = async () => {
    if (pendingFiles.length === 0) {
      toast.error("アップロードするファイルを選択してください")
      return
    }

    setIsUploading(true)
    let success = 0

    for (const file of pendingFiles) {
      try {
        const timestamp = Date.now()
        const extension = getExtension(file.name)
        const baseName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^\w\-]/g, "_")
        const storedFileName = `${timestamp}_${baseName}.${extension}`
        const filePath = `${folderPath}/${storedFileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file)

        if (uploadError) {
          console.error(uploadError)
          toast.error(`${file.name} のアップロードに失敗しました`)
          continue
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(uploadData.path)

        const { error: insertError } = await supabase
          .from("order_entry_files")
          .insert({
            order_entry_id: orderEntryId,
            file_url: publicUrlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
          })

        if (insertError) {
          console.error(insertError)
          toast.error(`${file.name} の登録に失敗しました`)
          continue
        }

        success++
      } catch (err) {
        console.error(err)
        toast.error(`${file.name} の処理中にエラーが発生しました`)
      }
    }

    if (success > 0) {
      toast.success(`${success} 件アップロードしました`)
      setPendingFiles([])
      fetchFiles()
    }

    setIsUploading(false)
  }

  const handleUploadSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return

    const validFiles = validateFiles(selectedFiles)
    if (validFiles.length === 0) return

    setPendingFiles((prev) => [...prev, ...validFiles])
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    handleUploadSelect(selectedFiles)
    e.target.value = ""
  }

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files ?? [])
    handleUploadSelect(droppedFiles)
  }

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearPendingFiles = () => {
    setPendingFiles([])
  }

  const deleteFile = async (fileId: string, fileName: string, fileUrl: string) => {
    try {
      const response = await fetch("/api/delete-order-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          fileName,
          fileUrl,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error(result)
        toast.error(result.error || "削除に失敗しました")
        return
      }

      toast.success(`${fileName} を削除しました`)
      setDeleteConfirm({
        isOpen: false,
        fileId: null,
        fileName: null,
        fileUrl: null,
      })
      fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("削除に失敗しました")
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>案件ファイル</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              ファイルがありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ファイル名</TableHead>
                  <TableHead>サイズ</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>{file.file_name}</TableCell>

                    <TableCell>{formatFileSize(file.file_size)}</TableCell>

                    <TableCell>
                      {format(new Date(file.created_at), "yyyy/M/d HH:mm", {
                        locale: ja,
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(file.file_url, "_blank")}
                          title="プレビュー"
                        >
                          <Eye className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(file.file_url, file.file_name)}
                          title="ダウンロード"
                        >
                          <Download className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          title="削除"
                          onClick={() =>
                            setDeleteConfirm({
                              isOpen: true,
                              fileId: file.id,
                              fileName: file.file_name,
                              fileUrl: file.file_url,
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ファイルアップロード</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            許可形式: {ALLOWED_EXTENSIONS.join(", ")} / 最大サイズ: 50MB
          </div>

          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={[
              "flex cursor-pointer flex-col items-center rounded-md border-2 border-dashed p-8 transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-border bg-background hover:border-primary/50 hover:bg-muted/30",
            ].join(" ")}
          >
            <Upload className="size-8" />
            <p className="mt-2 font-medium">
              {isDragging ? "ここにファイルをドロップ" : "ドラッグ＆ドロップ またはクリック"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDragging ? "ファイルを離すと追加されます" : "ファイルを選択して追加できます"}
            </p>

            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.ai,.eps,.zip,.jpg,.jpeg,.png"
            />
          </label>

          {pendingFiles.length > 0 && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">アップロード予定ファイル</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearPendingFiles}
                  disabled={isUploading}
                >
                  すべて取消
                </Button>
              </div>

              <div className="space-y-2">
                {pendingFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePendingFile(index)}
                      disabled={isUploading}
                    >
                      取消
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={uploadFiles} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    "アップロード実行"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm({
              isOpen: false,
              fileId: null,
              fileName: null,
              fileUrl: null,
            })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>削除しますか？</DialogTitle>
            <DialogDescription>{deleteConfirm.fileName}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteConfirm({
                  isOpen: false,
                  fileId: null,
                  fileName: null,
                  fileUrl: null,
                })
              }
            >
              キャンセル
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                deleteConfirm.fileId &&
                deleteConfirm.fileName &&
                deleteConfirm.fileUrl &&
                deleteFile(
                  deleteConfirm.fileId,
                  deleteConfirm.fileName,
                  deleteConfirm.fileUrl
                )
              }
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}