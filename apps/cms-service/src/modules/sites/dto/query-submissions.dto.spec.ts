import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FormSubmissionStatus } from '@prisma/client';
import { QuerySubmissionsDto } from './query-submissions.dto.js';

describe('QuerySubmissionsDto', () => {
  it('passes validation with empty optional params', async () => {
    const dto = plainToInstance(QuerySubmissionsDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation with valid fields', async () => {
    const dto = plainToInstance(QuerySubmissionsDto, {
      formKey: 'contact-form',
      status: FormSubmissionStatus.PENDING,
      page: '1',
      limit: '20',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('fails when status is invalid enum', async () => {
    const dto = plainToInstance(QuerySubmissionsDto, {
      status: 'INVALID_STATUS',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('status');
  });

  it('fails when page is invalid or limit out of range', async () => {
    const dto = plainToInstance(QuerySubmissionsDto, {
      page: 0,
      limit: 150,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
  });
});
