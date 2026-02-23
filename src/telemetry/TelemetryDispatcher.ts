import { toast } from "sonner";

export interface StochasticSignal {
  confidence: number;
  allocation: number;
  targetZone: string;
  volatilitySigma?: number;
}

function formatSignalMessage(signal: StochasticSignal): {
  title: string;
  body: string;
  confidencePct: string;
} {
  const confidencePct = (signal.confidence * 100).toFixed(2);
  const sigma = signal.volatilitySigma ?? 0;
  const status = sigma < 1.2 ? "STABLE" : "ELEVATED VARIANCE";

  const title = `High-Confidence Convergence — ${confidencePct}%`;
  const body = [
    `Allocation: ${signal.allocation.toFixed(4)} units`,
    `Target Zone: ${signal.targetZone}`,
    `Variance: ${sigma.toFixed(3)}`,
    `Status: ${status}`,
  ].join(" | ");

  return { title, body, confidencePct };
}

export function dispatchToast(signal: StochasticSignal): void {
  const { title, body } = formatSignalMessage(signal);

  if (signal.confidence >= 0.95) {
    toast.success(title, { description: body });
  } else {
    toast.warning(title, { description: body });
  }
}

export class TelemetryDispatcher {
  private minConfidence = 0.92;

  static async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return Notification.requestPermission();
  }

  async dispatchSignal(signal: StochasticSignal): Promise<void> {
    if (signal.confidence < this.minConfidence) return;

    const { title, body, confidencePct } = formatSignalMessage(signal);

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(title, { body });
      } catch {
        console.warn("[Telemetry] Browser notification failed");
      }
    }

    console.log(
      `[Telemetry] Signal dispatched — confidence ${confidencePct}%, zone ${signal.targetZone}`
    );
  }
}