import { Component, effect, provideZonelessChangeDetection, signal } from '@angular/core'
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
  protected readonly courts = signal<Court[]>([])
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
  private refreshing = false
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
      await this.loadCourts()
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
    this.courts.set(await this.api<Court[]>('/canchas/'))
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

  protected changeDate(date: string) {
    const court = this.selected()
    if (court && date) return this.run(() => this.loadSchedule(court, date))
  }

  private async loadSchedule(court: Court, date: string) {
    this.tab.set('horarios')
    this.selected.set(court)
    this.selectedHour.set(null)
    this.date.set(date)
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
