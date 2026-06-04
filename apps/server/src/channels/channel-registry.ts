import type { ChannelType, IChannelAdapter, IChannelRegistry } from "@gestor/core";

export class ChannelRegistry implements IChannelRegistry {
  private readonly adapters = new Map<ChannelType, IChannelAdapter>();
  private defaultType: ChannelType | null = null;

  register(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter);
    this.defaultType ??= adapter.channelType;
  }

  get(channelType: ChannelType): IChannelAdapter {
    const adapter = this.adapters.get(channelType);
    if (!adapter) throw new Error(`No hay adaptador para el canal: ${channelType}`);
    return adapter;
  }

  getDefault(): IChannelAdapter {
    if (!this.defaultType) throw new Error("No hay adaptadores registrados");
    return this.get(this.defaultType);
  }

  all(): IChannelAdapter[] {
    return [...this.adapters.values()];
  }
}
