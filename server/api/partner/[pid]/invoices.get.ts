export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'invoices.view')
  return useBackend().listInvoices(pid)
})
