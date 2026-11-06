export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return await sapGetCustomer(event, id)
  }
  catch (e: any) {
    throw createError({ statusCode: e?.statusCode ?? 502, message: e?.data?.message ?? 'SAP hiba' })
  }
})
