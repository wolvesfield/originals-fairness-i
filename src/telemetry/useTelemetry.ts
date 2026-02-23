import { useEffect, useRef, useCallback } from "react";
import {
  TelemetryDispatcher,
  dispatchToast,
  type StochasticSignal,
} from "./TelemetryDispatcher";

let singletonDispatcher: TelemetryDispatcher | null = null;

function getDispatcher(): TelemetryDispatcher {
  if (!singletonDispatcher) {
    singletonDispatcher = new TelemetryDispatcher();
  }
  return singletonDispatcher;
}

export function useTelemetry(): {
  dispatch: (signal: StochasticSignal) => void;
} {
  const dispatcherRef = useRef(getDispatcher());

  useEffect(() => {
    TelemetryDispatcher.requestNotificationPermission();
  }, []);

  const dispatch = useCallback((signal: StochasticSignal) => {
    dispatcherRef.current.dispatchSignal(signal);
    dispatchToast(signal);
  }, []);

  return { dispatch };
}
