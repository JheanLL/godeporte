import { Component, computed, effect, provideZonelessChangeDetection, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { messages } from './messages'

type Court = { id: string; nombre: string; ubicacion: string; caracteristicas: string; centimos: number; abre: number; cierra: number }
type Booking = { id: string; cancha: string; fecha: string; hora: number; centimos: number; estado: string; vence: number; usuario: string }
type Session = { token: string; nombre: string; role: string }
type Receipt = { qr: string; usado: boolean }
type Entry = Pick<Booking, 'cancha' | 'fecha' | 'hora' | 'usuario'>
const sessionKey = 'godeporte:sesion'
const pendingPaymentKey = 'godeporte:pago-pendiente'
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

type Catalog = { at: number; courts: Court[] }
const catalogKey = 'godeporte:catalogo:v1'

function initialCatalog(): Catalog | null {
  const parse = (raw: string | null): Catalog | null => {
    try {
      const value = JSON.parse(raw ?? 'null')
      return value && Number.isFinite(value.at) && Array.isArray(value.courts) ? value : null
    } catch {
      return null
    }
  }
  const snapshot = parse(document.getElementById('catalog-inicial')?.textContent ?? null)
  try {
    const stored = parse(localStorage.getItem(catalogKey))
    if (stored && Date.now() - stored.at < 86_400_000 && stored.at > (snapshot?.at ?? 0)) return stored
  } catch {
    // The embedded catalog is available when storage is disabled.
  }
  return snapshot
}

function savedSession(): Session | null {
  try {
    const session: Session | null = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    if (!session) return null
    const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()) return session
  } catch {
    // Ignore invalid session data.
  }
  sessionStorage.removeItem(sessionKey)
  return null
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  host: { '(window:hashchange)': 'routeChanged()' },
})
class App {
  protected readonly copy = messages
  private readonly initialCatalog = initialCatalog()
  protected readonly courts = signal<Court[]>(this.initialCatalog?.courts ?? [])
  protected readonly selected = signal<Court | null>(null)
  protected readonly selectedHour = signal<number | null>(null)
  protected readonly confirmation = signal<{ action: () => void; kind: 'book' | 'cancel' } | null>(null)
  protected readonly slots = signal<{ hora: number; libre: boolean }[]>([])
  protected readonly bookings = signal<Booking[]>([])
  protected readonly session = signal<Session | null>(savedSession())
  protected readonly receipt = signal<(Receipt & { booking: Booking }) | null>(null)
  protected readonly paying = signal<string | null>(null)
  protected readonly names = signal<Record<string, string>>({})
  protected readonly checkInCode = signal('')
  protected readonly entry = signal<Entry | null>(null)
  protected readonly status = signal('')
  protected readonly busy = signal(false)
  protected readonly tab = signal('canchas')
  protected readonly editing = signal<Court | null>(null)
  protected readonly today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date())
  protected readonly date = signal(this.today)
  protected readonly month = signal(this.today.slice(0, 7))
  protected readonly weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat('es-PE', {
    weekday: 'short', timeZone: 'UTC',
  }).format(new Date(Date.UTC(2024, 0, index + 1))))
  private readonly monthFormatter = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  private readonly dayFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeZone: 'UTC' })
  protected readonly monthTitle = computed(() => this.monthFormatter.format(new Date(this.month() + '-01T00:00:00Z')))
  protected readonly calendarDays = computed(() => {
    const [year, month] = this.month().split('-').map(Number)
    const first = new Date(Date.UTC(year, month - 1, 1))
    const offset = (first.getUTCDay() + 6) % 7
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return Array.from({ length: offset + last }, (_, index) => {
      if (index < offset) return null
      const day = index - offset + 1
      const date = new Date(Date.UTC(year, month - 1, day))
      return { day, key: date.toISOString().slice(0, 10), label: this.dayFormatter.format(date) }
    })
  })
  private refreshing = false
  private catalogRequest = 0
  private returnToSchedule = false
  private readonly configuration = fetch('config.json').then(async result => {
    if (!result.ok) throw new Error(messages.config)
    return (await result.json() as { api: string }).api
  })

  constructor() {
    effect(onCleanup => {
      if (!this.status() || this.paying()) return
      const timer = setTimeout(() => this.status.set(''), 6500)
      onCleanup(() => clearTimeout(timer))
    })
    this.openCheckIn()
    if (this.tab() === 'canchas' && this.session() && sessionStorage.getItem(pendingPaymentKey)) {
      this.tab.set('reservas')
    }
    void this.run(async () => {
      if (this.initialCatalog) {
        void this.loadCourts().catch(() => {})
      } else {
        await this.loadCourts()
      }
      const court = this.courtFromUrl()
      if (court) await this.loadSchedule(court, this.date())
      else if (this.tab() === 'reservas') await this.loadBookings()
    })
    setInterval(() => {
      if (this.isBookings() && this.session() && !this.busy() && !this.refreshing && !document.hidden) {
        this.refreshing = true
        void this.loadBookings().catch(() => {}).finally(() => { this.refreshing = false })
      }
    }, 5000)
  }

  private courtFromUrl() {
    const id = new URLSearchParams(location.hash.slice(1)).get('horarios')
    return this.courts().find(court => court.id === id)
  }

  protected routeChanged() {
    const court = this.courtFromUrl()
    if (court) {
      void this.run(() => this.loadSchedule(court, this.date()))
    } else if (this.tab() === 'horarios') {
      this.open('canchas')
    }
    this.openCheckIn()
  }

  private isBookings() {
    return this.tab() === 'reservas' || this.tab() === 'dashboard'
  }

  protected openCheckIn() {
    const code = new URLSearchParams(location.hash.slice(1)).get('ingreso')
    if (!code) return
    this.checkInCode.set(code)
    this.tab.set(this.session()?.role === 'admin' ? 'ingreso' : 'login')
  }

  private async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers = new Headers()
    const session = this.session()
    if (session) headers.set('Authorization', 'Bearer ' + session.token)
    if (body) headers.set('Content-Type', 'application/json')
    const response = await fetch((await this.configuration) + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000),
    })
    const data = await response.json().catch(() => null)
    if (response.status === 401 && session && path !== '/auth/login' && this.session() === session) {
      this.logout()
      this.tab.set('login')
    }
    if (!response.ok) throw new Error(data?.error ?? messages.request)
    return data as T
  }

  protected async run(action: () => Promise<void>) {
    if (this.busy()) return
    this.busy.set(true)
    this.status.set('')
    try {
      await action()
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : messages.unexpected)
    } finally {
      this.busy.set(false)
    }
  }

  private async loadCourts() {
    const request = ++this.catalogRequest
    const response = await fetch((await this.configuration) + '/canchas/', {
      cache: 'no-cache', signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(messages.request)
    const courts = await response.json() as Court[]
    if (!Array.isArray(courts)) throw new Error(messages.request)
    if (request !== this.catalogRequest) return
    this.courts.set(courts)
    try {
      localStorage.setItem(catalogKey, JSON.stringify({ at: Date.now(), courts }))
    } catch {
      // Keep the catalog usable when storage is disabled or full.
    }
  }

  protected open(tab: string) {
    this.tab.set(tab)
    this.status.set('')
    if (tab !== 'horarios' && this.courtFromUrl()) history.replaceState(null, '', location.pathname + location.search)
    if (this.isBookings()) {
      this.bookings.set([])
      this.receipt.set(null)
      void this.run(() => this.loadBookings())
    }
    window.scrollTo(0, 0)
  }

  private async loadBookings() {
    const actor = this.session()
    const view = this.tab()
    const bookings = await this.api<Booking[]>(view === 'dashboard' ? '/reservas/' : '/reservas/?mias=1')
    if (this.session() !== actor || this.tab() !== view) return
    this.bookings.set(bookings)
    if (actor?.role === 'admin') await this.loadNames(bookings.map(item => item.usuario))
    const pending = sessionStorage.getItem(pendingPaymentKey)
    const item = bookings.find(row => row.id === pending)
    if (item && this.session() === actor) await this.finishPayment(item)
  }

  private async loadNames(ids: string[]) {
    const missing = [...new Set(ids)].filter(id => !Object.hasOwn(this.names(), id))
    if (!missing.length) return
    const actor = this.session()
    const names = await this.api<Record<string, string>>('/auth/nombres', 'POST', { ids: missing })
    if (this.session() === actor) this.names.update(current => ({ ...current, ...names }))
  }

  protected customerName(id: string) {
    const actor = this.session()
    return actor?.role === 'cliente' ? actor.nombre : this.names()[id]
  }

  protected choose(court: Court) {
    history.pushState(null, '', '#' + new URLSearchParams({ horarios: court.id }))
    window.scrollTo(0, 0)
    return this.run(() => this.loadSchedule(court, this.date()))
  }

  protected moveMonth(delta: number) {
    const [year, month] = this.month().split('-').map(Number)
    const target = new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7)
    if (target >= this.today.slice(0, 7)) this.month.set(target)
  }

  protected changeDate(date: string) {
    const court = this.selected()
    if (court && date) return this.run(() => this.loadSchedule(court, date))
  }

  private async loadSchedule(court: Court, date: string) {
    this.tab.set('horarios')
    this.selected.set(court)
    this.selectedHour.set(null)
    this.date.set(date)
    this.month.set(date.slice(0, 7))
    this.slots.set([])
    const params = new URLSearchParams({ cancha: court.id, fecha: date })
    this.slots.set(await this.api('/reservas/disponibilidad?' + params))
  }

  protected confirm(dialog: HTMLDialogElement, kind: 'book' | 'cancel', action: () => void) {
    this.confirmation.set({ kind, action })
    dialog.showModal()
  }

  protected accept(dialog: HTMLDialogElement) {
    const confirmation = this.confirmation()
    dialog.close()
    confirmation?.action()
  }

  protected account(event: SubmitEvent, register: boolean) {
    event.preventDefault()
    const { email, password, nombre } = Object.fromEntries(new FormData(event.target as HTMLFormElement))
    return this.run(async () => {
      if (register) await this.api('/auth/registro', 'POST', { email, password, nombre })
      const session = await this.api<Session>('/auth/login', 'POST', { email, password })
      sessionStorage.setItem(sessionKey, JSON.stringify(session))
      this.session.set(session)
      const court = this.selected()
      if (this.returnToSchedule && court) {
        this.returnToSchedule = false
        history.replaceState(null, '', '#' + new URLSearchParams({ horarios: court.id }))
        this.tab.set('horarios')
        return
      }
      this.open('canchas')
      this.openCheckIn()
      if (this.checkInCode() && session.role !== 'admin') {
        this.tab.set('canchas')
        this.status.set(messages.adminRequired)
      }
    })
  }

  protected logout() {
    sessionStorage.removeItem(sessionKey)
    sessionStorage.removeItem(pendingPaymentKey)
    this.session.set(null)
    this.returnToSchedule = false
    this.bookings.set([])
    this.names.set({})
    this.entry.set(null)
    this.receipt.set(null)
    this.editing.set(null)
    this.open('canchas')
  }

  protected reserve(dialog: HTMLDialogElement) {
    const hora = this.selectedHour()
    const court = this.selected()
    if (hora === null || !court) return
    if (!this.session()) {
      this.returnToSchedule = true
      this.open('login')
      this.status.set(messages.loginRequired)
      return
    }
    const fecha = this.date()
    this.confirm(dialog, 'book', () => void this.run(async () => {
      await this.api('/reservas/', 'POST', { cancha: court.id, fecha, hora })
      history.replaceState(null, '', location.pathname + location.search)
      this.tab.set('reservas')
      await this.loadBookings()
      this.status.set(messages.reserved)
      window.scrollTo(0, 0)
    }))
  }

  protected pay(item: Booking, aprobado: boolean) {
    return this.run(async () => {
      const actor = this.session()
      this.paying.set(item.id)
      this.status.set(messages.processing)
      try {
        await this.api('/reservas/' + item.id + '/pagar', 'POST', { aprobado })
        if (this.session() !== actor) return
        sessionStorage.setItem(pendingPaymentKey, item.id)
        const end = Date.now() + 85_000
        while (this.session() === actor && Date.now() < end) {
          const current = await this.api<Booking>('/reservas/' + item.id)
          if (this.session() !== actor) return
          this.bookings.update(rows => rows.map(row => row.id === current.id ? current : row))
          if (current.estado !== 'PENDIENTE') {
            await this.finishPayment(current)
            return
          }
          await delay(1500)
        }
        if (this.session() === actor) this.status.set(messages.processingLater)
      } finally {
        this.paying.set(null)
      }
    })
  }

  private async finishPayment(item: Booking) {
    if (item.estado === 'PENDIENTE') return
    if (item.estado === 'CONFIRMADA') {
      this.status.set(messages.confirmed)
      const actor = this.session()
      const receipt = await this.api<Receipt>('/notificaciones/comprobante/' + item.id).catch(() => null)
      if (!receipt || this.session() !== actor) return
      this.receipt.set({ ...receipt, booking: item })
    } else {
      this.status.set(item.estado === 'EXPIRADA' ? messages.expired : messages.closed)
    }
    if (sessionStorage.getItem(pendingPaymentKey) === item.id) sessionStorage.removeItem(pendingPaymentKey)
  }

  protected confirmCancellation(dialog: HTMLDialogElement, item: Booking) {
    this.confirm(dialog, 'cancel', () => void this.cancel(item))
  }

  private cancel(item: Booking) {
    return this.run(async () => {
      await this.api('/reservas/' + item.id + '/cancelar', 'POST')
      this.receipt.set(null)
      await this.loadBookings()
    })
  }

  protected showReceipt(item: Booking) {
    return this.run(async () => {
      this.receipt.set(null)
      const receipt = await this.api<Receipt>('/notificaciones/comprobante/' + item.id)
      this.receipt.set({ ...receipt, booking: item })
      if (sessionStorage.getItem(pendingPaymentKey) === item.id) sessionStorage.removeItem(pendingPaymentKey)
    })
  }

  protected validate(code: string) {
    return this.run(async () => {
      let value = code.trim()
      if (URL.canParse(value)) value = new URLSearchParams(new URL(value).hash.slice(1)).get('ingreso') ?? ''
      if (!value) throw new Error(messages.invalidCode)
      this.entry.set(null)
      const entry = await this.api<Entry>('/notificaciones/validar/' + encodeURIComponent(value), 'POST')
      this.entry.set(entry)
      this.checkInCode.set('')
      history.replaceState(null, '', location.pathname + location.search)
      this.status.set(messages.checkIn)
      if (entry.usuario) await this.loadNames([entry.usuario]).catch(() => {})
    })
  }

  protected saveCourt(event: SubmitEvent) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.target as HTMLFormElement))
    return this.run(async () => {
      const id = this.editing()?.id ?? crypto.randomUUID()
      await this.api('/canchas/' + id, 'PUT', {
        ...fields, centimos: Math.round(Number(fields.tarifa) * 100),
        abre: Number(fields.abre), cierra: Number(fields.cierra),
      })
      this.editing.set(null)
      await this.loadCourts()
      this.status.set(messages.saved)
    })
  }

  protected courtName(id: string) {
    return this.courts().find(court => court.id === id)?.nombre ?? id
  }

  protected price(centimos: number) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(centimos / 100)
  }

  protected time(hour: number) {
    return String(hour).padStart(2, '0') + ':00'
  }

  protected deadline(epoch: number) {
    return new Date(epoch * 1000).toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })
  }

  protected count(state: string) {
    return this.bookings().filter(item => item.estado === state).length
  }
}

void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] })
