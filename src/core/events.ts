/**
 * Engine kernel — typed, dependency-free event bus.
 * Renderer-agnostic; part of the reusable core (future game-engine background).
 */

export type EventHandler<P> = (payload: P) => void;

export class EventBus<EventMap extends object> {
  private readonly handlers = new Map<keyof EventMap, Set<EventHandler<never>>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<never>);
    return () => {
      this.off(type, handler);
    };
  }

  /** Subscribe for exactly one delivery. */
  once<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): () => void {
    const off = this.on(type, (payload: EventMap[K]) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<never>);
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.handlers.get(type);
    if (set === undefined) return;
    // Snapshot so handlers may subscribe/unsubscribe during dispatch.
    for (const handler of [...set]) {
      (handler as EventHandler<EventMap[K]>)(payload);
    }
  }

  listenerCount(type: keyof EventMap): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
