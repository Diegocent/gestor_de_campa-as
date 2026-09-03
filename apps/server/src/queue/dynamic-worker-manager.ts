import { Worker, type Processor } from "bullmq";

export interface RateLimit {
  /** Máximo de jobs procesados por ventana. */
  max: number;
  /** Duración de la ventana en milisegundos. */
  durationMs: number;
}

/**
 * Worker BullMQ con limitador de tasa DINÁMICO.
 *
 * Para cambiar el límite sin reiniciar Node: se cierra suavemente el worker
 * activo (`worker.close()` espera a que el job en curso termine) y se instancia
 * uno nuevo en caliente con el límite actualizado. Permite ralentizar envíos
 * automáticamente si la conexión se satura.
 */
export class DynamicRateLimitedWorker<T = unknown> {
  private worker: Worker<T> | null = null;
  private current: RateLimit;
  private recycling: Promise<void> | null = null;

  constructor(
    private readonly queueName: string,
    private readonly connection: any,
    private readonly processor: Processor<T>,
    initial: RateLimit
  ) {
    this.current = initial;
  }

  start(): void {
    if (this.worker) return;
    this.worker = this.spawn(this.current);
  }

  getLimit(): RateLimit {
    return this.current;
  }

  /**
   * Aplica un nuevo límite en caliente. Es seguro ante llamadas concurrentes:
   * encola el reciclaje para no solapar dos transiciones.
   */
  async updateLimit(next: RateLimit): Promise<void> {
    this.current = next;
    this.recycling = (this.recycling ?? Promise.resolve()).then(() => this.recycle(next));
    await this.recycling;
  }

  private async recycle(limit: RateLimit): Promise<void> {
    const old = this.worker;
    this.worker = null;
    // Interrupción suave: espera a que termine el job activo antes de cerrar.
    if (old) await old.close();
    // Worker nuevo en caliente con el límite vigente.
    this.worker = this.spawn(limit);
  }

  async stop(): Promise<void> {
    const old = this.worker;
    this.worker = null;
    await old?.close();
  }

  private spawn(limit: RateLimit): Worker<T> {
    return new Worker<T>(this.queueName, this.processor, {
      connection: this.connection as any,
      concurrency: 1,
      limiter: { max: limit.max, duration: limit.durationMs },
    });
  }
}
