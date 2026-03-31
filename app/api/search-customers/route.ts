import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('customers')
      .select('customer_code, customer_name')
      .ilike('customer_name', `%${query}%`)
      .limit(20)

    if (error) {
      console.error('[v0] Supabase error:', error)
      return Response.json(
        { error: 'Failed to fetch customers' },
        { status: 500 }
      )
    }

    return Response.json({ customers: data || [] })
  } catch (error) {
    console.error('[v0] API error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
