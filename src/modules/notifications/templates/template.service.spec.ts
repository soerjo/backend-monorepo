import { TemplateService } from './template.service.js';

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService();
  });

  it('reports known templates', () => {
    expect(service.has('otp')).toBe(true);
    expect(service.has('notification-default')).toBe(true);
    expect(service.has('does-not-exist')).toBe(false);
  });

  it('renders placeholders in the body', () => {
    const rendered = service.render('otp', {
      otp: '482910',
      expires_in_minutes: 5,
    });
    expect(rendered.body).toContain('482910');
    expect(rendered.body).toContain('5');
    expect(rendered.body).not.toContain('{{otp}}');
  });

  it('falls back to literal content for the default template', () => {
    const rendered = service.render('notification-default', {
      title: 'Hello',
      body: 'World',
    });
    expect(rendered.title).toBe('Hello');
    expect(rendered.body).toBe('World');
  });

  it('uses the fallback branch when content is absent', () => {
    const rendered = service.render('notification-default', {});
    expect(rendered.title).toBe('Notification');
  });

  it('escapes html by default', () => {
    const rendered = service.render('notification-default', {
      body: '<script>alert(1)</script>',
    });
    expect(rendered.body).not.toContain('<script>');
  });

  it('throws for unknown templates', () => {
    expect(() => service.render('unknown', {})).toThrow(
      'Unknown notification template',
    );
  });
});
