/**
 * Real-Time Telemetry Dispatcher — Multi-Channel Alert System
 * Sends high-confidence stochastic convergence alerts via:
 *   - Discord webhook
 *   - SMTP email endpoint
 *   - Console fallback
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
  private discordWebhookUrl: string;
  private minConfidence = 0.92;

  constructor(
    smtpEndpoint: string = process.env.SMTP_ENDPOINT || '',
    recipientEmail: string = process.env.ALERT_RECIPIENT_EMAIL || '',
    senderEmail: string = process.env.ALERT_SENDER_EMAIL || 'fairness-suite@localhost',
    discordWebhookUrl: string = process.env.DISCORD_WEBHOOK_URL || ''
  ) {
    this.smtpEndpoint = smtpEndpoint;
    this.recipientEmail = recipientEmail;
    this.senderEmail = senderEmail;
    this.discordWebhookUrl = discordWebhookUrl;
  }

  /**
   * Dispatches alerts to all configured channels when confidence exceeds threshold.
   */
  async dispatchSignal(signal: StochasticSignal): Promise<void> {
    if (signal.confidence < this.minConfidence) return;

    const sigma = signal.volatilitySigma ?? 0;
    const status = sigma < 1.2 ? '🟢 STABLE' : '🟡 ELEVATED VARIANCE';
    const confidencePct = (signal.confidence * 100).toFixed(2);
    const timestamp = new Date().toISOString();

    const subject = `🚨 High-Confidence Convergence — ${confidencePct}%`;

    const bodyLines = [
      '═══════════════════════════════════════════',
      '  PROVABLY FAIR STATISTICAL INTEGRITY SUITE',
      '  High-Confidence Event Notification',
      '═══════════════════════════════════════════',
      '',
      `  Confidence Score:    ${confidencePct}%`,
      `  Risk-Adjusted Alloc: ${signal.allocation.toFixed(4)} Units`,
      `  Target Zone:         ${signal.targetZone}`,
      `  Current Variance σ:  ${sigma.toFixed(3)}`,
      `  Status:              ${status}`,
      '',
      `  Timestamp:           ${timestamp}`,
      '═══════════════════════════════════════════',
    ];
    const body = bodyLines.join('\n');

    const results: string[] = [];

    // Channel 1: Discord webhook
    if (this.discordWebhookUrl) {
      try {
        await fetch(this.discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: subject,
              description: [
                `**Confidence:** ${confidencePct}%`,
                `**Allocation:** ${signal.allocation.toFixed(4)} units`,
                `**Target Zone:** ${signal.targetZone}`,
                `**Variance σ:** ${sigma.toFixed(3)}`,
                `**Status:** ${status}`,
              ].join('\n'),
              color: signal.confidence >= 0.95 ? 0x00ff00 : 0xffaa00,
              timestamp,
            }]
          }),
        });
        results.push('Discord ✅');
      } catch (error) {
        console.error('[Telemetry] Discord webhook error:', error);
        results.push('Discord ❌');
      }
    }

    // Channel 2: SMTP email
    if (this.smtpEndpoint) {
      try {
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
        results.push('Email ✅');
      } catch (error) {
        console.error('[Telemetry] Email dispatch error:', error);
        results.push('Email ❌');
      }
    }

    // Fallback: console log when no channels configured
    if (!this.discordWebhookUrl && !this.smtpEndpoint) {
      console.log(`[Telemetry] ALERT (no channels configured):\n${subject}\n${body}`);
      results.push('Console ✅');
    } else {
      console.log(`[Telemetry] Dispatched: ${results.join(', ')}`);
    }
  }
}