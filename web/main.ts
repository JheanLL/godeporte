import { Component, provideZonelessChangeDetection, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { messages } from './messages'

type Court = { id: string; nombre: string; ubicacion: string; caracteristicas: string; centimos: number; abre: number; cierra: number }
type Booking = { id: string; cancha: string; fecha: string; hora: number; centimos: number; estado: string; vence: number }
type Session = { token: string; nombre: string; role: string }
type Receipt = { codigo: string; qr: string; usado: boolean }

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
class App {
  protected readonly copy = messages
  protected readonly courts = signal<Court[]>([])
  protected readonly selected = signal<Court | null>(null)
  protected readonly slots = signal<{ hora: number; libre: boolean }[]>([])
  protected readonly bookings = signal<Booking[]>([])
  protected readonly session = signal<Session | null>(null)
  protected readonly receipt = signal<Receipt | null>(null)
  protected readonly status = signal('')
  protected readonly busy = signal(false)
  protected readonly tab = signal('canchas')
  protected readonly editing = signal<Court | null>(null)
  protected readonly today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date())
  protected readonly date = signal(this.today)
  private readonly configuration = fetch('config.json').then(async result => {
    if (!result.ok) throw new Error(messages.config)
    return (await result.json() as { api: string }).api
  })

  constructor() {
    void this.run(() => this.loadCourts())
  }

  private async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers = new Headers()
    const session = this.session()
    if (session) headers.set('Authorization', 'Bearer ' + session.token)
    if (body) headers.set('Content-Type', 'application/json')
    const response = await fetch((await this.configuration) + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => null)
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
    if (tab === 'reservas') void this.run(() => this.loadBookings())
  }

  private async loadBookings() {
    this.bookings.set(await this.api<Booking[]>('/reservas/'))
  }

  protected choose(court: Court, date = this.date()) {
    return this.run(async () => {
      this.selected.set(court)
      this.date.set(date)
      this.slots.set([])
      const params = new URLSearchParams({ cancha: court.id, fecha: date })
      this.slots.set(await this.api('/reservas/disponibilidad?' + params))
    })
  }

  protected account(event: SubmitEvent, register: boolean) {
    event.preventDefault()
    const { email, password, nombre } = Object.fromEntries(new FormData(event.target as HTMLFormElement))
    return this.run(async () => {
      if (register) await this.api('/auth/registro', 'POST', { email, password, nombre })
      this.session.set(await this.api('/auth/login', 'POST', { email, password }))
      this.open('canchas')
    })
  }

  protected logout() {
    this.session.set(null)
    this.bookings.set([])
    this.receipt.set(null)
    this.editing.set(null)
    this.open('canchas')
  }

  protected reserve(hora: number) {
    if (!this.session()) {
      this.open('login')
      this.status.set(messages.loginRequired)
      return
    }
    return this.run(async () => {
      await this.api('/reservas/', 'POST', { cancha: this.selected()?.id, fecha: this.date(), hora })
      await this.loadBookings()
      this.tab.set('reservas')
      this.status.set(messages.reserved)
    })
  }

  protected pay(item: Booking, aprobado: boolean) {
    return this.run(async () => {
      await this.api('/reservas/' + item.id + '/pagar', 'POST', { aprobado })
      this.status.set(messages.processing)
      await this.loadBookings()
    })
  }

  protected cancel(item: Booking) {
    return this.run(async () => {
      await this.api('/reservas/' + item.id + '/cancelar', 'POST')
      this.receipt.set(null)
      await this.loadBookings()
    })
  }

  protected showReceipt(item: Booking) {
    return this.run(async () => {
      this.receipt.set(null)
      this.receipt.set(await this.api<Receipt>('/notificaciones/comprobante/' + item.id))
    })
  }

  protected validate(code: string) {
    return this.run(async () => {
      await this.api('/notificaciones/validar/' + encodeURIComponent(code.trim()), 'POST')
      this.status.set(messages.checkIn)
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
