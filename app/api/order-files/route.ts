import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderEntryId = searchParams.get("orderEntryId")

    if (!orderEntryId) {
      return NextResponse.json(
        { error: "orderEntryId is required" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("order_entry_files")
      .select("*")
      .eq("order_entry_id", orderEntryId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[order-files] fetch error:", error)
      return NextResponse.json(
        { error: "ファイル一覧の取得に失敗しました" },
        { status: 500 }
      )
    }

    return NextResponse.json({ files: data ?? [] })
  } catch (error) {
    console.error("[order-files] unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}