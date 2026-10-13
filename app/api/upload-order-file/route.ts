import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sanitizeForStorage } from "@/lib/storage-utils"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const orderEntryId = formData.get("orderEntryId") as string
    const orderNumber = formData.get("orderNumber") as string
    const files = formData.getAll("files") as File[]

    if (!orderEntryId || !orderNumber || files.length === 0) {
      return NextResponse.json(
        { error: "必要な情報が不足しています" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const bucketName = "order-files"
    const safeOrderNumber = sanitizeForStorage(orderNumber)

    const uploadedFiles: {
      id: string
      name: string
      url: string
    }[] = []

    for (const file of files) {
      const timestamp = Date.now()
      const extension = file.name.split(".").pop() || ""
      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^\w\-]/g, "_")

      const storedFileName = `${timestamp}_${baseName}.${extension}`
      const filePath = `${safeOrderNumber}/${storedFileName}`

      const { data: uploadData, error: uploadError } =
        await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          })

      if (uploadError) {
        console.error("[upload-order-file] storage error:", uploadError)
        continue
      }

      const { data: publicUrlData } =
        supabase.storage
          .from(bucketName)
          .getPublicUrl(uploadData.path)

      const { data: fileData, error: insertError } =
        await supabase
          .from("order_entry_files")
          .insert({
            order_entry_id: orderEntryId,
            file_url: publicUrlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
          })
          .select("id")
          .single()

      if (insertError || !fileData) {
        console.error("[upload-order-file] DB error:", insertError)
        continue
      }

      uploadedFiles.push({
        id: fileData.id,
        name: file.name,
        url: publicUrlData.publicUrl,
      })
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "ファイルのアップロードに失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      uploadedFiles,
    })
  } catch (error) {
    console.error("[upload-order-file] unexpected error:", error)

    return NextResponse.json(
      { error: "ファイルアップロード中にエラーが発生しました" },
      { status: 500 }
    )
  }
}