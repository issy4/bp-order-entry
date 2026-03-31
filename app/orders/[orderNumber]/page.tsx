export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { OrderFolderFiles } from "@/components/order-folder-files"

interface OrderEntryDetail {
  id: number
  order_number: string
  customer_name: string | null
  product_name: string | null
  sales_user_code: string | null
  order_date: string | null
}

interface UserData {
  name: string | null
  user_code: string | null
}

export default async function OrderFolderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_entries")
    .select("*")
    .eq("order_number", orderNumber)
    .limit(1)

  const orderData = data?.[0] as OrderEntryDetail | undefined

  if (error || !orderData) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/orders">
            <Button variant="outline" className="mb-6">
              <ArrowLeft className="mr-2 size-4" />
              受注一覧へ戻る
            </Button>
          </Link>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">受注情報が見つかりません</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  let salesUserName: string | null = null

  if (orderData.sales_user_code) {
    const { data: userData } = await supabase
      .from("users")
      .select("name, user_code")
      .eq("user_code", orderData.sales_user_code)
      .maybeSingle()

    salesUserName = (userData as UserData | null)?.name ?? null
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link href="/orders">
          <Button variant="outline">
            <ArrowLeft className="mr-2 size-4" />
            受注一覧へ戻る
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>案件情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">受注番号</p>
                <p className="font-mono font-semibold">
                  {orderData.order_number || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">顧客名</p>
                <p className="font-semibold">
                  {orderData.customer_name || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">案件名</p>
                <p className="font-semibold">
                  {orderData.product_name || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">担当者</p>
                <p className="font-semibold">
                  {salesUserName || orderData.sales_user_code || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">受注日</p>
                <p>
                  {orderData.order_date
                    ? format(new Date(orderData.order_date), "yyyy年M月d日", {
                      locale: ja,
                    })
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <OrderFolderFiles
          orderEntryId={orderData.id}
          orderNumber={orderNumber}
        />
      </div>
    </main>
  )
}