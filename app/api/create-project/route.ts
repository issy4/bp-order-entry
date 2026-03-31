import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sanitizeForStorage } from "@/lib/storage-utils"
import nodemailer from "nodemailer"

function createMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const orderNumber = formData.get("orderNumber") as string
    const customerCode = formData.get("customerCode") as string
    const customerName = formData.get("customerName") as string
    const productName = formData.get("productName") as string
    const createUserCode = formData.get("create_user_code") as string
    const deliveryDate = formData.get("deliveryDate") as string
    const files = formData.getAll("files") as File[]

    if (!orderNumber || !customerCode || !productName || !createUserCode || !deliveryDate) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // ==========================
    // 1. 受注登録
    // ==========================

    const { data: orderData, error: orderError } = await supabase
      .from("order_entries")
      .insert({
        order_number: orderNumber,
        customer_code: customerCode,
        customer_name: customerName,
        product_name: productName,
        sales_user_code: createUserCode,
        order_date: deliveryDate,
      })
      .select("id")
      .single()

    if (orderError || !orderData) {
      console.error("[v0] Supabase insert error:", orderError)

      return NextResponse.json(
        { error: "受注の登録に失敗しました" },
        { status: 500 }
      )
    }

    const orderEntryId = orderData.id

    // ==========================
    // 2. ファイルアップロード
    // ==========================

    const uploadedFiles: { name: string; url: string }[] = []

    if (files.length > 0) {
      const safeOrderNumber = sanitizeForStorage(orderNumber)

      for (const file of files) {
        const timestamp = Math.floor(Date.now() / 1000)
        const extension = file.name.split(".").pop() || ""
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^\w\-]/g, "_")

        const filePath = `${safeOrderNumber}/${timestamp}_${baseName}.${extension}`

        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from("order-files")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            })

        if (uploadError) {
          console.error("[v0] File upload error:", uploadError)
          continue
        }

        const { data: publicData } =
          supabase.storage
            .from("order-files")
            .getPublicUrl(uploadData.path)

        const fileUrl = publicData.publicUrl

        uploadedFiles.push({
          name: file.name,
          url: fileUrl,
        })

        const { error: fileError } =
          await supabase
            .from("order_entry_files")
            .insert({
              order_entry_id: orderEntryId,
              file_url: fileUrl,
              file_name: file.name,
              file_size: file.size,
            })

        if (fileError) {
          console.error("[v0] File record insert error:", fileError)
        }
      }
    }

    // ==========================
    // 担当者名取得
    // ==========================

    let userName = createUserCode

    const { data: userData } = await supabase
      .from("users")
      .select("name")
      .eq("user_code", createUserCode)
      .single()

    if (userData?.name) {
      userName = userData.name
    }

    // ==========================
    // 3. Google Chat通知
    // ==========================

    const webhook =
      "https://chat.googleapis.com/v1/spaces/AAQAy7VCo_4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=xPtye6aANgfE2qeg17bmbgFgcVvUU2WuhfAvlM2nfJ4"

    const fileWidgets = uploadedFiles.map((file) => ({
      decoratedText: {
        topLabel: "添付ファイル",
        text: `<a href="${file.url}">${file.name}</a>`,
      },
    }))

    let widgets: any[] = [
      {
        decoratedText: {
          topLabel: "受注番号",
          text: orderNumber,
        },
      },
      {
        decoratedText: {
          topLabel: "品名 / 案件名",
          text: productName,
        },
      },
      {
        decoratedText: {
          topLabel: "担当者",
          text: userName,
        },
      },
    ]

    widgets = widgets.concat(fileWidgets)

    widgets.push({
      buttonList: {
        buttons: [
          {
            text: "📁 案件フォルダ",
            onClick: {
              openLink: {
                url: `https://ci.bp.express/orders/${orderNumber}`,
              },
            },
          },
        ],
      },
    })

    widgets.push({
      textParagraph: {
        text: "▼ この案件の連絡はスレッドで返信してください",
      },
    })

    const payload = {
      text: `#${orderNumber} ${productName} ${userName}`,
      cardsV2: [
        {
          cardId: "order",
          card: {
            header: {
              title: "📦 新規受注",
              subtitle: `${orderNumber}｜${productName}｜${userName}`,
            },
            sections: [
              {
                widgets: widgets,
              },
            ],
          },
        },
      ],
    }

    if (webhook) {
      await fetch(`${webhook}&threadKey=${orderNumber}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    }

    // ==========================
    // 4. Gmail通知
    // ==========================

    try {
      const transporter = createMailer()

      const subject =
        `【新規受注】${orderNumber} / ${productName} / ${userName}`

      const folderUrl = `https://ci.bp.express/orders/${orderNumber}`

      const mailBody =
        "新しい受注が登録されました\n\n" +
        "受注番号\n" + orderNumber + "\n\n" +
        "品名 / 案件名\n" + productName + "\n\n" +
        "担当者\n" + userName + "\n\n" +
        "案件フォルダ\n" + folderUrl

      await transporter.sendMail({
        from: `"受注通知システム" <${process.env.ORDER_NOTIFY_FROM}>`,
        to: process.env.ORDER_NOTIFY_TO,
        subject,
        text: mailBody,
      })
    } catch (mailError) {
      console.error("[v0] Gmail send error:", mailError)
    }

    return NextResponse.json({
      success: true,
      message: "受注が正常に登録されました",
      data: { id: orderEntryId },
    })
  } catch (error) {
    console.error("[v0] Error processing order:", error)

    return NextResponse.json(
      { error: "受注の処理中にエラーが発生しました" },
      { status: 500 }
    )
  }
}