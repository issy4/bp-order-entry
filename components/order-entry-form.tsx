"use client"

import { useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarIcon, Upload, X, Search, CheckIcon, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldGroup, FieldError } from "@/components/ui/field"

interface Customer {
  customer_code: string
  customer_name: string
}

interface SalesPerson {
  user_code: string
  name: string
}

interface FormData {
  orderNumber: string
  customerCode: string
  customerName: string
  productName: string
  create_user_code: string
  deliveryDate: Date | undefined
  attachments: File[]
}

interface FormErrors {
  orderNumber?: string
  customerCode?: string
  productName?: string
  create_user_code?: string
  deliveryDate?: string
  attachments?: string
}

export function OrderEntryForm() {
  const [formData, setFormData] = useState<FormData>({
    orderNumber: "",
    customerCode: "",
    customerName: "",
    productName: "",
    create_user_code: "",
    deliveryDate: undefined,
    attachments: [],
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [customerSearch, setCustomerSearch] = useState("")
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Load sales persons from Supabase on mount
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const response = await fetch("/api/get-sales-persons")
        if (response.ok) {
          const data = await response.json()
          setSalesPersons(data.users || [])
        }
      } catch (error) {
        console.error("[v0] Failed to fetch sales persons:", error)
      }
    }
    fetchSalesPersons()
  }, [])

  // Search customers from Supabase via API
  useEffect(() => {
    const searchCustomers = async () => {
      if (!customerSearch.trim()) {
        setFilteredCustomers([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/search-customers?query=${encodeURIComponent(customerSearch)}`)
        if (response.ok) {
          const data = await response.json()
          setFilteredCustomers(data.customers || [])
        }
      } catch (error) {
        console.error('[v0] Customer search error:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchCustomers, 300)
    return () => clearTimeout(debounceTimer)
  }, [customerSearch])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.orderNumber.trim()) {
      newErrors.orderNumber = "受注番号を入力してください"
    } else if (!/^[A-Z0-9-]+$/i.test(formData.orderNumber)) {
      newErrors.orderNumber = "英数字とハイフンのみ使用できます"
    }

    if (!formData.customerCode) {
      newErrors.customerCode = "顧客を選択してください"
    }

    if (!formData.productName.trim()) {
      newErrors.productName = "製品名を入力してください"
    }

    if (!formData.create_user_code) {
      newErrors.create_user_code = "担当者を選択してください"
    }

    if (!formData.deliveryDate) {
      newErrors.deliveryDate = "納品予定日を選択してください"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitStatus("idle")

    try {
      // Submit form data with files
      const submitData = new FormData()
      submitData.append("orderNumber", formData.orderNumber)
      submitData.append("customerCode", formData.customerCode)
      submitData.append("customerName", formData.customerName)
      submitData.append("productName", formData.productName)
      submitData.append("create_user_code", formData.create_user_code)
      submitData.append("deliveryDate", formData.deliveryDate?.toISOString() || "")

      // Append files directly to FormData
      for (const file of formData.attachments) {
        submitData.append("files", file)
      }

      const response = await fetch("/api/create-project", {
        method: "POST",
        body: submitData,
      })

      if (response.ok) {
        setSubmitStatus("success")
        // Reset form
        setFormData({
          orderNumber: "",
          customerCode: "",
          customerName: "",
          productName: "",
          create_user_code: "",
          deliveryDate: undefined,
          attachments: [],
        })
        setCustomerSearch("")
      } else {
        setSubmitStatus("error")
      }
    } catch {
      setSubmitStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          attachments: `${file.name} は10MB以下である必要があります`,
        }))
        return false
      }
      return true
    })

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles],
    }))

    if (validFiles.length > 0) {
      setErrors((prev) => ({ ...prev, attachments: undefined }))
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return

    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          attachments: `${file.name} は10MB以下である必要があります`,
        }))
        return false
      }
      return true
    })

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles],
    }))

    if (validFiles.length > 0) {
      setErrors((prev) => ({ ...prev, attachments: undefined }))
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])


  const removeFile = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }, [])

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <FieldGroup>
        {/* Order Number */}
        <Field data-invalid={!!errors.orderNumber}>
          <FieldLabel htmlFor="orderNumber">
            受注番号 <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="orderNumber"
            value={formData.orderNumber}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, orderNumber: e.target.value }))
              if (errors.orderNumber) setErrors((prev) => ({ ...prev, orderNumber: undefined }))
            }}
            aria-invalid={!!errors.orderNumber}
            className="w-full"
          />
          {errors.orderNumber && <FieldError>{errors.orderNumber}</FieldError>}
        </Field>

        {/* Customer - Searchable Dropdown */}
        <Field data-invalid={!!errors.customerCode}>
          <FieldLabel htmlFor="customer">
            顧客 <span className="text-destructive">*</span>
          </FieldLabel>
          <Popover open={isCustomerDropdownOpen} onOpenChange={setIsCustomerDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                id="customer"
                variant="outline"
                role="combobox"
                aria-expanded={isCustomerDropdownOpen}
                aria-invalid={!!errors.customerCode}
                className={cn(
                  "w-full justify-between font-normal",
                  !formData.customerCode && "text-muted-foreground"
                )}
              >
                {formData.customerCode ? (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{formData.customerCode}</span>
                    <span>{formData.customerName}</span>
                  </span>
                ) : (
                  "顧客を選択..."
                )}
                <Search className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 size-4 shrink-0 opacity-50" />
                <input
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="顧客名・コードで検索..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {customerSearch ? "該当する顧客が見つかりません" : "顧客を検索..."}
                  </p>
                ) : (
                  filteredCustomers.map((customer, index) => (
                    <button
                      key={`${customer.customer_code}-${customer.customer_name}-${index}`}
                      type="button"
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        formData.customerCode === customer.customer_code && "bg-accent"
                      )}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          customerCode: customer.customer_code,
                          customerName: customer.customer_name,
                        }))
                        setIsCustomerDropdownOpen(false)
                        setCustomerSearch("")
                        if (errors.customerCode) setErrors((prev) => ({ ...prev, customerCode: undefined }))
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 size-4",
                          formData.customerCode === customer.customer_code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-muted-foreground text-xs mr-2">{customer.customer_code}</span>
                      <span>{customer.customer_name}</span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          {errors.customerCode && <FieldError>{errors.customerCode}</FieldError>}
        </Field>

        {/* Product Name */}
        <Field data-invalid={!!errors.productName}>
          <FieldLabel htmlFor="productName">
            品名 / 案件名 <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="productName"
            placeholder="例: 高性能モーター 製品カタログ"
            value={formData.productName}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, productName: e.target.value }))
              if (errors.productName) setErrors((prev) => ({ ...prev, productName: undefined }))
            }}
            aria-invalid={!!errors.productName}
            className="w-full"
          />
          {errors.productName && <FieldError>{errors.productName}</FieldError>}
        </Field>

        {/* Sales Person */}
        <Field data-invalid={!!errors.create_user_code}>
          <FieldLabel htmlFor="salesPerson">
            担当者 <span className="text-destructive">*</span>
          </FieldLabel>

          <Select
            value={formData.create_user_code || ""}
            onValueChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                create_user_code: value
              }))

              if (errors.create_user_code) {
                setErrors((prev) => ({
                  ...prev,
                  create_user_code: undefined
                }))
              }
            }}
          >
            <SelectTrigger
              id="salesPerson"
              className="w-full"
              aria-invalid={!!errors.create_user_code}
            >
              <SelectValue placeholder="担当者を選択..." />
            </SelectTrigger>

            <SelectContent>

              {salesPersons?.map((person) => (
                <SelectItem
                  key={`${person.user_code}-${person.name}`}
                  value={String(person.user_code)}
                >
                  {person.name}
                </SelectItem>
              ))}

            </SelectContent>
          </Select>

          {errors.create_user_code && (
            <FieldError>{errors.create_user_code}</FieldError>
          )}
        </Field>

        {/* Delivery Date */}
        <Field data-invalid={!!errors.deliveryDate}>
          <FieldLabel htmlFor="deliveryDate">
            受注日 <span className="text-destructive">*</span>
          </FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="deliveryDate"
                variant="outline"
                aria-invalid={!!errors.deliveryDate}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.deliveryDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {formData.deliveryDate ? (
                  format(formData.deliveryDate, "yyyy年MM月dd日", { locale: ja })
                ) : (
                  <span>日付を選択...</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.deliveryDate}
                onSelect={(date) => {
                  setFormData((prev) => ({ ...prev, deliveryDate: date }))
                  if (errors.deliveryDate) setErrors((prev) => ({ ...prev, deliveryDate: undefined }))
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.deliveryDate && <FieldError>{errors.deliveryDate}</FieldError>}
        </Field>

        {/* File Attachment */}
        <Field data-invalid={!!errors.attachments}>
          <FieldLabel htmlFor="attachment">添付ファイル</FieldLabel>
          {formData.attachments.length > 0 ? (
            <div className="space-y-2">
              {formData.attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3"
                >
                  <Upload className="size-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeFile(index)}
                    className="shrink-0"
                  >
                    <X className="size-4" />
                    <span className="sr-only">ファイルを削除</span>
                  </Button>
                </div>
              ))}
              <label
                htmlFor="attachment"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 transition-colors",
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  <span className="text-primary underline underline-offset-2">ファイルを追加</span>
                </p>
              </label>
            </div>
          ) : (
            <label
              htmlFor="attachment"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 transition-colors",
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  ファイルをドラッグ&ドロップ
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  または<span className="text-primary underline underline-offset-2">クリックして選択</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">最大10MB / ファイル</p>
            </label>
          )}
          <input
            id="attachment"
            type="file"
            multiple
            className="sr-only"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
          {errors.attachments && <FieldError>{errors.attachments}</FieldError>}
        </Field>
      </FieldGroup>

      {/* Submit Status Messages */}
      {submitStatus === "success" && (
        <div className="mt-6 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          受注が正常に登録されました。
        </div>
      )}
      {submitStatus === "error" && (
        <div className="mt-6 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          受注の登録に失敗しました。もう一度お試しください。
        </div>
      )}

      {/* Submit Button */}
      <div className="mt-8 flex justify-center">
        <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[160px]">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              送信中...
            </>
          ) : (
            "受注を登録"
          )}
        </Button>
      </div>
    </form>
  )
}
