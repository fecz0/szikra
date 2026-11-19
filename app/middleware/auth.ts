export default defineNuxtRouteMiddleware(async () => {
  const fetcher = useRequestFetch()
  try {
    await fetcher('/api/auth/me')
  }
  catch {
    return navigateTo('/')
  }
})
