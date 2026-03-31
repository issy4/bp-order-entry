import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fileId = body.fileId as string | undefined
    const fileName = body.fileName as string | undefined
    const fileUrl = body.fileUrl as string | undefined

    if (!fileId || !fileUrl) {
      return NextResponse.json(
        { error: "必要な情報が不足しています" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const bucketName = "order-files"
    const storagePath = extractStoragePath(fileUrl, bucketName)

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([storagePath])

      if (storageError) {
        console.error("[delete-order-file] storageError:", storageError)
        return NextResponse.json(
          { error: "Storageファイルの削除に失敗しました" },
          { status: 500 }
        )
      }
    }

    const { error: dbError } = await supabase
      .from("order_entry_files")
      .delete()
      .eq("id", fileId)

    if (dbError) {
      console.error("[delete-order-file] dbError:", dbError)
      return NextResponse.json(
        { error: "DBデータの削除に失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${fileName ?? "ファイル"} を削除しました`,
    })
  } catch (error) {
    console.error("[delete-order-file] error:", error)
    return NextResponse.json(
      { error: "削除処理中にエラーが発生しました" },
      { status: 500 }
    )
  }
}