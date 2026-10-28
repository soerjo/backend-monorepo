import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

type RequestMetricLabels = 'method' | 'route' | 'status';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly requestsTotal = new Counter<RequestMetricLabels>({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  private readonly requestDuration = new Histogram<RequestMetricLabels>({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly sentSuccessTotal = new Counter<'channel'>({
    name: 'sent_success_total',
    help: 'Total number of successfully sent notifications',
    labelNames: ['channel'],
    registers: [this.registry],
  });

  private readonly sentFailedTotal = new Counter<'channel'>({
    name: 'sent_failed_total',
    help: 'Total number of failed notification send attempts',
    labelNames: ['channel'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordDelivery(channel: string, success: boolean): void {
    const counter = success ? this.sentSuccessTotal : this.sentFailedTotal;
    counter.inc({ channel: String(channel) });
  }

  recordRequest(
    method: string,
    route: string,
    status: number | string,
    durationSeconds: number,
  ): void {
    const labels = {
      method: String(method),
      route: String(route),
      status: String(status),
    };
    this.requestsTotal.inc(labels);
    this.requestDuration.observe(labels, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
