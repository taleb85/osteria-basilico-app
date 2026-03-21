declare module 'pulltorefreshjs' {
  interface PullToRefreshInstance {
    destroy: () => void;
  }
  const PullToRefresh: {
    init: (options: {
      mainElement?: string | HTMLElement;
      triggerElement?: string | HTMLElement;
      distThreshold?: number;
      distMax?: number;
      shouldPullToRefresh?: () => boolean;
      onRefresh?: () => Promise<void>;
      instructionsPullToRefresh?: string;
      instructionsReleaseToRefresh?: string;
      instructionsRefreshing?: string;
    }) => PullToRefreshInstance;
  };
  export default PullToRefresh;
}
