import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED_USER_CODES = ["6", "11", "15", "17", "22", "25", "30", "85", "90", "91", "92"]

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("users")
      .select("user_code, name")
      .in("user_code", ALLOWED_USER_CODES)
      .eq("is_active", true)
      .order("user_code", { ascending: true })

    if (error) {
      console.error("[v0] Supabase error fetching users:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    console.error("[v0] Unexpected error fetching users:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
