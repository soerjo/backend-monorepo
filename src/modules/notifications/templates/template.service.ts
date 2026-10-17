import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { getTemplate } from '../../../templates/index.js';

export interface RenderedTemplate {
  title: string;
  body: string;
}

@Injectable()
export class TemplateService {
  private readonly handlebars = Handlebars.create();
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();

  has(code: string): boolean {
    return getTemplate(code) !== undefined;
  }

  render(code: string, context: Record<string, unknown>): RenderedTemplate {
    const template = getTemplate(code);
    if (!template) {
      throw new Error(`Unknown notification template: "${code}"`);
    }

    return {
      title: this.compile(template.code, 'title', template.title)(context),
      body: this.compile(template.code, 'body', template.body)(context),
    };
  }

  renderBody(code: string, context: Record<string, unknown>): string {
    return this.render(code, context).body;
  }

  private compile(
    code: string,
    section: 'title' | 'body',
    source: string,
  ): Handlebars.TemplateDelegate {
    const cacheKey = `${code}:${section}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const compiled = this.handlebars.compile(source);
    this.cache.set(cacheKey, compiled);
    return compiled;
  }
}
