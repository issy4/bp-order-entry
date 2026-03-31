import { OrderEntryForm } from "@/components/order-entry-form"

export default function OrderEntryPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">受注情報登録</h1>
          <p className="text-sm text-muted-foreground mt-2">受注情報を入力してください</p>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 sm:p-8">
          <OrderEntryForm />
        </div>
      </div>
    </main>
  )
}
