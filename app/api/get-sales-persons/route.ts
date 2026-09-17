import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("users")
      .select("user_code, name")
      .eq("is_active", true)
      .eq("is_sales_user", true)
      .order("user_code", { ascending: true })

    if (error) {
      console.error("[get-sales-persons] Supabase error:", error)

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      users: data ?? [],
    })
  } catch (err) {
    console.error("[get-sales-persons] Unexpected error:", err)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}