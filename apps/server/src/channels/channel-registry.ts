import type { ChannelType, IChannelAdapter, IChannelRegistry } from "@gestor/core";

export class ChannelRegistry implements IChannelRegistry {
  private readonly adapters = new Map<string, IChannelAdapter>(); // key: sessionName
  private defaultSession: string | null = null;
  /** Round-robin counter por channelType */
  private rrCounters = new Map<ChannelType, number>();

  register(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.sessionName, adapter);
    this.defaultSession ??= adapter.sessionName;
  }

  unregister(sessionName: string): void {
    this.adapters.delete(sessionName);
    if (this.defaultSession === sessionName) {
      this.defaultSession = this.adapters.size > 0 ? this.adapters.keys().next().value! : null;
    }
  }

  get(channelType: ChannelType): IChannelAdapter {
    for (const adapter of this.adapters.values()) {
      if (adapter.channelType === channelType) return adapter;
    }
    throw new Error(`No hay adaptador para el canal: ${channelType}`);
  }

  getDefault(): IChannelAdapter {
    if (!this.defaultSession) throw new Error("No hay adaptadores registrados");
    return this.adapters.get(this.defaultSession)!;
  }

  getBySession(sessionName: string): IChannelAdapter | undefined {
    return this.adapters.get(sessionName);
  }

  getNextForNewConversation(channelType: ChannelType): IChannelAdapter | undefined {
    const ready = [...this.adapters.values()].filter(
      (a) => a.channelType === channelType && a.isReady()
    );
    if (ready.length === 0) return undefined;
    const counter = this.rrCounters.get(channelType) ?? 0;
    const next = ready[counter % ready.length]!;
    this.rrCounters.set(channelType, counter + 1);
    return next;
  }

  all(): IChannelAdapter[] {
    return [...this.adapters.values()];
  }
}
