type EventListener = (event: unknown) => void;

export class EventBus {
  private listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`event listener failed: ${String(error)}`);
      }
    }
  }
}