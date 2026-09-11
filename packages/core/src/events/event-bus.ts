import { EventEmitter } from 'node:events';
import type { AgentEvent, AgentEventType } from './types.js';

export type AgentEventListener = (event: AgentEvent) => void;

/** Typed pub/sub bus for structured agent/task events, backed by Node's `EventEmitter`. */
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly history: AgentEvent[] = [];

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(event: AgentEvent): void {
    this.history.push(event);
    this.emitter.emit('event', event);
    this.emitter.emit(event.type, event);
  }

  /** Subscribes to every event regardless of type. Returns an unsubscribe function. */
  onEvent(listener: AgentEventListener): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  /** Subscribes to a single event type. Returns an unsubscribe function. */
  onType(type: AgentEventType, listener: AgentEventListener): () => void {
    this.emitter.on(type, listener);
    return () => this.emitter.off(type, listener);
  }

  getHistory(): readonly AgentEvent[] {
    return this.history;
  }
}
