import { describe, expect, it, vi } from 'vitest';
import { createAgentEvent, EventBus } from '@crewforge/core';

describe('EventBus', () => {
  it('notifies onEvent subscribers for every published event', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.onEvent(listener);

    const event = createAgentEvent('agent-started', { role: 'backend' });
    bus.publish(event);

    expect(listener).toHaveBeenCalledWith(event);
    expect(bus.getHistory()).toEqual([event]);
  });

  it('notifies onType subscribers only for the matching event type', () => {
    const bus = new EventBus();
    const startedListener = vi.fn();
    const completedListener = vi.fn();
    bus.onType('agent-started', startedListener);
    bus.onType('agent-completed', completedListener);

    bus.publish(createAgentEvent('agent-started', {}));

    expect(startedListener).toHaveBeenCalledTimes(1);
    expect(completedListener).not.toHaveBeenCalled();
  });

  it('allows unsubscribing', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsubscribe = bus.onEvent(listener);
    unsubscribe();

    bus.publish(createAgentEvent('agent-started', {}));

    expect(listener).not.toHaveBeenCalled();
  });
});
