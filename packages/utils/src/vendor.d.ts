declare module 'watchpack' {
  import { EventEmitter } from 'events';

  export interface TimeInfo {
    safeTime?: number;
    timestamp?: number;
    accuracy?: number;
  }

  class Watchpack extends EventEmitter {
    constructor(options: {
      aggregateTimeout?: number;
      poll?: boolean;
      followSymlinks?: boolean;
      ignored?: string | RegExp | string[];
    });
    watch(options: {
      files?: string[];
      directories?: string[];
      missing?: string[];
      startTime?: number;
    }): void;
    pause(): void;
    close(): void;

    getAggregated(): { changes: Set<string>; removals: Set<string> };
    getTimeInfoEntries(): Map<string, TimeInfo>;
    collectTimeInfoEntries(
      fileInfoEntries: Map<string, TimeInfo>,
      directoryInfoEntries: Map<string, TimeInfo>
    ): void;
  }

  export default Watchpack;
}
