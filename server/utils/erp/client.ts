// Vékony ERPNext (Frappe) REST-kliens. Nuxt/Nitro-függetlenül fut (a seed/export szkriptek is használják),
// ezért nincs benne auto-import.
export interface ErpAuth { key: string, secret: string }
export interface ErpLogin { user: string, password: string }

export class ErpError extends Error {
  status: number
  body?: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export class ErpClient {
  private cookie = ''
  private baseUrl: string
  private auth: ErpAuth | ErpLogin
  constructor(baseUrl: string, auth: ErpAuth | ErpLogin) {
    this.baseUrl = baseUrl
    this.auth = auth
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    if ('key' in this.auth) {
      h.Authorization = `token ${this.auth.key}:${this.auth.secret}`
    }
    else {
      if (!this.cookie) {
        const res = await fetch(`${this.baseUrl}/api/method/login`, { method: 'POST', headers: h, body: JSON.stringify({ usr: this.auth.user, pwd: this.auth.password }) })
        if (!res.ok) throw new ErpError(res.status, `ERPNext belépés sikertelen (${res.status})`)
        this.cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
      }
      h.Cookie = this.cookie
    }
    return h
  }

  async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers: await this.headers(), body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json: any
    try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
    if (!res.ok) throw new ErpError(res.status, `ERPNext ${method} ${path} -> ${res.status}: ${String(json?.exception ?? json?._server_messages ?? text).slice(0, 400)}`, json)
    return json as T
  }

  async list<T = any>(doctype: string, opts: { fields?: string[], filters?: unknown[], orderBy?: string } = {}): Promise<T[]> {
    const q = new URLSearchParams({ limit_page_length: '0' })
    q.set('fields', JSON.stringify(opts.fields ?? ['name']))
    if (opts.filters) q.set('filters', JSON.stringify(opts.filters))
    if (opts.orderBy) q.set('order_by', opts.orderBy)
    return (await this.request<{ data: T[] }>('GET', `/api/resource/${encodeURIComponent(doctype)}?${q}`)).data
  }

  /** Gyermektábla (pl. Sales Invoice Item) listázása: a Frappe a szülő doctype nevét is kéri. */
  async listChild<T = any>(doctype: string, parent: string, opts: { fields?: string[], filters?: unknown[] } = {}): Promise<T[]> {
    return this.method<T[]>('frappe.client.get_list', { doctype, parent, fields: opts.fields ?? ['name'], filters: opts.filters ?? [], limit_page_length: 0 }, 'GET')
  }

  async get<T = any>(doctype: string, name: string): Promise<T> {
    return (await this.request<{ data: T }>('GET', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)).data
  }

  async create<T = any>(doctype: string, doc: Record<string, unknown>): Promise<T> {
    return (await this.request<{ data: T }>('POST', `/api/resource/${encodeURIComponent(doctype)}`, doc)).data
  }

  async update<T = any>(doctype: string, name: string, doc: Record<string, unknown>): Promise<T> {
    return (await this.request<{ data: T }>('PUT', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, doc)).data
  }

  async method<T = any>(name: string, args: Record<string, unknown> = {}, verb: 'GET' | 'POST' = 'POST'): Promise<T> {
    if (verb === 'GET') {
      const q = new URLSearchParams(Object.entries(args).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
      return (await this.request<{ message: T }>('GET', `/api/method/${name}?${q}`)).message
    }
    return (await this.request<{ message: T }>('POST', `/api/method/${name}`, args)).message
  }
}
