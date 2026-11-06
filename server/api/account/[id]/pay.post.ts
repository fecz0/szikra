export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { billId } = await readBody<{ billId: string }>(event)
  try {
    return await sapPayBill(event, id, billId)
  }
  catch (e: any) {
    throw createError({ statusCode: e?.statusCode ?? 502, message: e?.data?.message ?? 'SAP hiba' })
  }
})
