import { createClient } from "@/lib/supabase/server"

interface OrderEntry {
  id: number
  order_number: string
  customer_name: string | null
  product_name: string | null
  sales_user_code: string | null
  order_date: string | null
}

interface UserRow {
  user_code: string | null
  name: string | null
}

const SORTABLE_COLUMNS = {
  order_number: "order_number",
  customer_name: "customer_name",
  product_name: "product_name",
  order_date: "order_date",
} as const

type SortKey = keyof typeof SORTABLE_COLUMNS
type SortOrder = "asc" | "desc"

function escapeCsv(value: string | null | undefined) {
  const text = value ?? ""
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const orderNumber = searchParams.get("orderNumber")?.trim() ?? ""
  const customerName = searchParams.get("customerName")?.trim() ?? ""
  const productName = searchParams.get("productName")?.trim() ?? ""
  const salesUserCode = searchParams.get("salesUserCode")?.trim() ?? ""

  const rawSort = searchParams.get("sort") ?? "order_date"
  const rawDir = searchParams.get("dir") ?? "desc"

  const sort: SortKey =
    rawSort in SORTABLE_COLUMNS ? (rawSort as SortKey) : "order_date"
  const dir: SortOrder = rawDir === "asc" ? "asc" : "desc"

  const supabase = await createClient()

  let query = supabase
    .from("order_entries")
    .select(`
      id,
      order_number,
      customer_name,
      product_name,
      sales_user_code,
      order_date
    `)
    .order(SORTABLE_COLUMNS[sort], {
      ascending: dir === "asc",
      nullsFirst: false,
    })

  if (orderNumber) {
    query = query.ilike("order_number", `%${orderNumber}%`)
  }

  if (customerName) {
    query = query.ilike("customer_name", `%${customerName}%`)
  }

  if (productName) {
    query = query.ilike("product_name", `%${productName}%`)
  }

  if (salesUserCode) {
    query = query.ilike("sales_user_code", `%${salesUserCode}%`)
  }

  const { data: orderData, error: orderError } = await query

  if (orderError) {
    return new Response("CSV出力に失敗しました", { status: 500 })
  }

  const orders = (orderData ?? []) as OrderEntry[]

  const userCodes = Array.from(
    new Set(
      orders
        .map((order) => order.sales_user_code)
        .filter((code): code is string => !!code)
    )
  )

  let userMap = new Map<string, string>()

  if (userCodes.length > 0) {
    const { data: userData } = await supabase
      .from("users")
      .select("user_code, name")
      .in("user_code", userCodes)

    userMap = new Map(
      ((userData ?? []) as UserRow[])
        .filter((user) => user.user_code && user.name)
        .map((user) => [user.user_code as string, user.name as string])
    )
  }

  const header = [
    "受注番号",
    "顧客名",
    "案件名",
    "担当者コード",
    "担当者名",
    "受注日",
  ]

  const rows = orders.map((order) => [
    escapeCsv(order.order_number),
    escapeCsv(order.customer_name),
    escapeCsv(order.product_name),
    escapeCsv(order.sales_user_code),
    escapeCsv(order.sales_user_code ? userMap.get(order.sales_user_code) : ""),
    escapeCsv(order.order_date),
  ])

  const csv = [header.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\r\n")

  const now = new Date()
  const fileName = `orders_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`

  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}