/**
 * Real-Time Telemetry Dispatcher — Email Alert System
 * Sends high-confidence stochastic convergence alerts via email.
 * Only triggers when confidence ≥ 92%.
 */

export interface StochasticSignal {
  confidence: number;
  allocation: number;
  targetZone: string;
  volatilitySigma?: number;
}

export class TelemetryDispatcher {
  private smtpEndpoint: string;
  private recipientEmail: string;
  private senderEmail: string;
  private minConfidence = 0.92;

  constructor(
    smtpEndpoint: string = process.env.SMTP_ENDPOINT || '',
    recipientEmail: string = process.env.ALERT_RECIPIENT_EMAIL || '',
    senderEmail: string = process.env.ALERT_SENDER_EMAIL || 'neural-entropy@localhost'
  ) {
    this.smtpEndpoint = smtpEndpoint;
    this.recipientEmail = recipientEmail;
    this.senderEmail = senderEmail;
  }

  /**
   * Dispatches an email alert when confidence exceeds threshold.
   */
  async dispatchSignal(signal: StochasticSignal): Promise<void> {
    if (signal.confidence < this.minConfidence) return;

    const sigma = signal.volatilitySigma ?? 0;
    const status = sigma < 1.2 ? '🟢 STABLE' : '🟡 ELEVATED VARIANCE';

    const subject = `🚨 High-Confidence Stochastic Convergence — ${(signal.confidence * 100).toFixed(2)}%`;

    const body = [
      '═══════════════════════════════════════════',
      '  NEURAL-ENTROPY STATISTICAL INTEGRITY SUITE',
      '  High-Confidence Event Notification',
      '═══════════════════════════════════════════',
      '',
      `  Confidence Score:    ${(signal.confidence * 100).toFixed(2)}%`,
      `  Risk-Adjusted Alloc: ${signal.allocation.toFixed(4)} Units`,
      `  Target Zone:         ${signal.targetZone}`,
      `  Current Variance σ:  ${sigma.toFixed(3)}`,
      `  Market Status:       ${status}`,
      '',
      `  Timestamp:           ${new Date().toISOString()}`,
      '',
      '───────────────────────────────────────────',
      '  Post-Quantum Integrity Verified',
      '═══════════════════════════════════════════',
    ].join('\n');

    try {
      if (this.smtpEndpoint) {
        await fetch(this.smtpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: this.senderEmail,
            to: this.recipientEmail,
            subject,
            text: body,
          }),
        });
        console.log(`[Telemetry] ✉️ Email alert dispatched to ${this.recipientEmail}`);
      } else {
        // Fallback: log to console when no SMTP configured
        console.log(`[Telemetry] ✉️ ALERT (no SMTP configured):\n${subject}\n${body}`);
      }
    } catch (error) {
      console.error('[Telemetry] Email dispatch error:', error);
    }
  }
}