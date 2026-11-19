export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    return await sapFindCustomerByMeter(event, id)
  }
  catch (e: any) {
    const notFound = e?.statusCode === 404
    throw createError({
      statusCode: e?.statusCode ?? 502,
      message: notFound ? 'Nem található ügyfél ehhez a mérőóra ID-hoz.' : (e?.data?.message ?? 'SAP hiba'),
    })
  }
})
