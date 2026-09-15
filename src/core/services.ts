/**
 * Engine kernel — typed service registry (lightweight dependency injection).
 * Keys are branded objects so consumers cannot fetch the wrong shape.
 */

export interface ServiceKey<T> {
  readonly name: string;
  /** Phantom type marker — never assigned at runtime. */
  readonly __serviceType?: T;
}

export function createServiceKey<T>(name: string): ServiceKey<T> {
  return { name };
}

export class ServiceRegistry {
  private readonly services = new Map<ServiceKey<unknown>, unknown>();

  set<T>(key: ServiceKey<T>, instance: T): void {
    this.services.set(key as ServiceKey<unknown>, instance);
  }

  has<T>(key: ServiceKey<T>): boolean {
    return this.services.has(key as ServiceKey<unknown>);
  }

  get<T>(key: ServiceKey<T>): T {
    if (!this.services.has(key as ServiceKey<unknown>)) {
      throw new Error(`Service not registered: "${key.name}"`);
    }
    return this.services.get(key as ServiceKey<unknown>) as T;
  }
}
