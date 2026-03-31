import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import Link from "next/link"
import { Plus, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

const PAGE_SIZE = 20

const SORTABLE_COLUMNS = {
  order_number: "order_number",
  customer_name: "customer_name",
  product_name: "product_name",
  order_date: "order_date",
} as const

type SortKey = keyof typeof SORTABLE_COLUMNS
type SortOrder = "asc" | "desc"

function buildOrdersUrl(params: {
  page?: number
  orderNumber?: string
  customerName?: string
  productName?: string
  salesUserCode?: string
  sort?: SortKey
  dir?: SortOrder
}) {
  const searchParams = new URLSearchParams()

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page))
  }
  if (params.orderNumber?.trim()) {
    searchParams.set("orderNumber", params.orderNumber.trim())
  }
  if (params.customerName?.trim()) {
    searchParams.set("customerName", params.customerName.trim())
  }
  if (params.productName?.trim()) {
    searchParams.set("productName", params.productName.trim())
  }
  if (params.salesUserCode?.trim()) {
    searchParams.set("salesUserCode", params.salesUserCode.trim())
  }
  if (params.sort && params.sort !== "order_date") {
    searchParams.set("sort", params.sort)
  }
  if (params.dir && params.dir !== "desc") {
    searchParams.set("dir", params.dir)
  }

  const query = searchParams.toString()
  return query ? `/orders?${query}` : "/orders"
}

function buildSortUrl(params: {
  currentOrderNumber: string
  currentCustomerName: string
  currentProductName: string
  currentSalesUserCode: string
  currentSort: SortKey
  currentDir: SortOrder
  nextSort: SortKey
}) {
  const nextDir: SortOrder =
    params.currentSort === params.nextSort && params.currentDir === "asc"
      ? "desc"
      : "asc"

  return buildOrdersUrl({
    page: 1,
    orderNumber: params.currentOrderNumber,
    customerName: params.currentCustomerName,
    productName: params.currentProductName,
    salesUserCode: params.currentSalesUserCode,
    sort: params.nextSort,
    dir: nextDir,
  })
}

function renderSortMark(currentSort: SortKey, currentDir: SortOrder, target: SortKey) {
  if (currentSort !== target) return "↕"
  return currentDir === "asc" ? "↑" : "↓"
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)

  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
    if (i >= 1 && i <= totalPages) {
      pages.add(i)
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string
    orderNumber?: string
    customerName?: string
    productName?: string
    salesUserCode?: string
    sort?: string
    dir?: string
  }>
}) {
  const resolvedSearchParams = await searchParams

  const currentPage = Math.max(1, Number(resolvedSearchParams?.page ?? "1") || 1)
  const orderNumber = resolvedSearchParams?.orderNumber?.trim() ?? ""
  const customerName = resolvedSearchParams?.customerName?.trim() ?? ""
  const productName = resolvedSearchParams?.productName?.trim() ?? ""
  const salesUserCode = resolvedSearchParams?.salesUserCode?.trim() ?? ""

  const rawSort = resolvedSearchParams?.sort ?? "order_date"
  const rawDir = resolvedSearchParams?.dir ?? "desc"

  const sort: SortKey =
    rawSort in SORTABLE_COLUMNS ? (rawSort as SortKey) : "order_date"
  const dir: SortOrder = rawDir === "asc" ? "asc" : "desc"

  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  let query = supabase
    .from("order_entries")
    .select(
      `
        id,
        order_number,
        customer_name,
        product_name,
        sales_user_code,
        order_date
      `,
      { count: "exact" }
    )

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

  const { data: orderData, error: orderError, count } = await query
    .order(SORTABLE_COLUMNS[sort], {
      ascending: dir === "asc",
      nullsFirst: false,
    })
    .range(from, to)

  if (orderError) {
    console.error("[orders] Error fetching order_entries:", orderError)
  }

  const orders = (orderData ?? []) as OrderEntry[]
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const userCodes = Array.from(
    new Set(
      orders
        .map((order) => order.sales_user_code)
        .filter((code): code is string => !!code)
    )
  )

  let userMap = new Map<string, string>()
  let salesUserOptions: UserRow[] = []

  const { data: allUsers, error: allUsersError } = await supabase
    .from("users")
    .select("user_code, name")
    .not("user_code", "is", null)
    .not("name", "is", null)
    .order("name", { ascending: true })

  if (allUsersError) {
    console.error("[orders] Error fetching all users:", allUsersError)
  } else {
    salesUserOptions = ((allUsers ?? []) as UserRow[]).filter(
      (user) => user.user_code && user.name
    )
  }

  if (userCodes.length > 0) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_code, name")
      .in("user_code", userCodes)

    if (userError) {
      console.error("[orders] Error fetching users:", userError)
    } else {
      userMap = new Map(
        ((userData ?? []) as UserRow[])
          .filter((user) => user.user_code && user.name)
          .map((user) => [user.user_code as string, user.name as string])
      )
    }
  }

  const startItem = totalCount === 0 ? 0 : from + 1
  const endItem = totalCount === 0 ? 0 : Math.min(from + PAGE_SIZE, totalCount)
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  const csvUrl = `/orders/export?${new URLSearchParams({
    ...(orderNumber ? { orderNumber } : {}),
    ...(customerName ? { customerName } : {}),
    ...(productName ? { productName } : {}),
    ...(salesUserCode ? { salesUserCode } : {}),
    sort,
    dir,
  }).toString()}`

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">受注一覧</h1>
            <p className="text-sm text-muted-foreground">
              全{totalCount}件中 {startItem}〜{endItem}件を表示
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="https://ci.bp.express/">
                <Plus className="mr-2 size-4" />
                新規受注登録
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href={csvUrl}>
                <Download className="mr-2 size-4" />
                CSVダウンロード
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>検索条件</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/orders" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1">
                <label htmlFor="orderNumber" className="text-sm font-medium">
                  受注番号
                </label>
                <input
                  id="orderNumber"
                  type="text"
                  name="orderNumber"
                  defaultValue={orderNumber}
                  placeholder="受注番号で検索"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="customerName" className="text-sm font-medium">
                  顧客名
                </label>
                <input
                  id="customerName"
                  type="text"
                  name="customerName"
                  defaultValue={customerName}
                  placeholder="顧客名で検索"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="productName" className="text-sm font-medium">
                  案件名
                </label>
                <input
                  id="productName"
                  type="text"
                  name="productName"
                  defaultValue={productName}
                  placeholder="案件名で検索"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="salesUserCode" className="text-sm font-medium">
                  担当者
                </label>
                <select
                  id="salesUserCode"
                  name="salesUserCode"
                  defaultValue={salesUserCode}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">すべて</option>
                  {salesUserOptions.map((user) => (
                    <option key={user.user_code} value={user.user_code ?? ""}>
                      {user.name} ({user.user_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button type="submit" className="flex-1">
                  検索
                </Button>
                <Button type="button" variant="outline" asChild className="flex-1">
                  <Link href="/orders">解除</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>受注データ</CardTitle>
          </CardHeader>

          <CardContent>
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                受注データがありません
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Link
                            href={buildSortUrl({
                              currentOrderNumber: orderNumber,
                              currentCustomerName: customerName,
                              currentProductName: productName,
                              currentSalesUserCode: salesUserCode,
                              currentSort: sort,
                              currentDir: dir,
                              nextSort: "order_number",
                            })}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            受注番号 {renderSortMark(sort, dir, "order_number")}
                          </Link>
                        </TableHead>
                        <TableHead>
                          <Link
                            href={buildSortUrl({
                              currentOrderNumber: orderNumber,
                              currentCustomerName: customerName,
                              currentProductName: productName,
                              currentSalesUserCode: salesUserCode,
                              currentSort: sort,
                              currentDir: dir,
                              nextSort: "customer_name",
                            })}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            顧客名 {renderSortMark(sort, dir, "customer_name")}
                          </Link>
                        </TableHead>
                        <TableHead>
                          <Link
                            href={buildSortUrl({
                              currentOrderNumber: orderNumber,
                              currentCustomerName: customerName,
                              currentProductName: productName,
                              currentSalesUserCode: salesUserCode,
                              currentSort: sort,
                              currentDir: dir,
                              nextSort: "product_name",
                            })}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            案件名 {renderSortMark(sort, dir, "product_name")}
                          </Link>
                        </TableHead>
                        <TableHead>担当者</TableHead>
                        <TableHead>
                          <Link
                            href={buildSortUrl({
                              currentOrderNumber: orderNumber,
                              currentCustomerName: customerName,
                              currentProductName: productName,
                              currentSalesUserCode: salesUserCode,
                              currentSort: sort,
                              currentDir: dir,
                              nextSort: "order_date",
                            })}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            受注日 {renderSortMark(sort, dir, "order_date")}
                          </Link>
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {orders.map((order) => {
                        const userName = order.sales_user_code
                          ? userMap.get(order.sales_user_code)
                          : null

                        return (
                          <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <Link
                                href={`/orders/${order.order_number}`}
                                className="font-mono text-primary hover:underline"
                              >
                                {order.order_number}
                              </Link>
                            </TableCell>
                            <TableCell>{order.customer_name || "-"}</TableCell>
                            <TableCell>{order.product_name || "-"}</TableCell>
                            <TableCell>{userName || order.sales_user_code || "-"}</TableCell>
                            <TableCell>
                              {order.order_date
                                ? format(new Date(order.order_date), "yyyy/M/d", {
                                  locale: ja,
                                })
                                : "-"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">
                    ページ {currentPage} / {totalPages}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={currentPage <= 1}
                      asChild={currentPage > 1}
                    >
                      {currentPage > 1 ? (
                        <Link
                          href={buildOrdersUrl({
                            page: currentPage - 1,
                            orderNumber,
                            customerName,
                            productName,
                            salesUserCode,
                            sort,
                            dir,
                          })}
                        >
                          前へ
                        </Link>
                      ) : (
                        <span>前へ</span>
                      )}
                    </Button>

                    {pageNumbers.map((page, index) => {
                      const prevPage = pageNumbers[index - 1]
                      const showEllipsis = index > 0 && prevPage && page - prevPage > 1

                      return (
                        <span key={page} className="flex items-center gap-2">
                          {showEllipsis && (
                            <span className="px-1 text-sm text-muted-foreground">…</span>
                          )}

                          <Button
                            variant={page === currentPage ? "default" : "outline"}
                            asChild={page !== currentPage}
                          >
                            {page === currentPage ? (
                              <span>{page}</span>
                            ) : (
                              <Link
                                href={buildOrdersUrl({
                                  page,
                                  orderNumber,
                                  customerName,
                                  productName,
                                  salesUserCode,
                                  sort,
                                  dir,
                                })}
                              >
                                {page}
                              </Link>
                            )}
                          </Button>
                        </span>
                      )
                    })}

                    <Button
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      asChild={currentPage < totalPages}
                    >
                      {currentPage < totalPages ? (
                        <Link
                          href={buildOrdersUrl({
                            page: currentPage + 1,
                            orderNumber,
                            customerName,
                            productName,
                            salesUserCode,
                            sort,
                            dir,
                          })}
                        >
                          次へ
                        </Link>
                      ) : (
                        <span>次へ</span>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}