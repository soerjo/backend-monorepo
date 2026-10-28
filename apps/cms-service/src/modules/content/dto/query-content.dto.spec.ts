import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { QueryContentDto } from './query-content.dto.js';

describe('QueryContentDto', () => {
  it('passes validation with empty optional params', async () => {
    const dto = plainToInstance(QueryContentDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation with valid fields', async () => {
    const dto = plainToInstance(QueryContentDto, {
      contentTypeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: ContentStatus.PUBLISHED,
      locale: 'id',
      page: '2',
      limit: '25',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
  });

  it('fails when contentTypeId is not a valid UUID', async () => {
    const dto = plainToInstance(QueryContentDto, {
      contentTypeId: 'invalid-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('contentTypeId');
  });

  it('fails when status is invalid enum', async () => {
    const dto = plainToInstance(QueryContentDto, {
      status: 'NOT_A_STATUS',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('status');
  });

  it('fails when page is less than 1 or limit exceeds 100', async () => {
    const dto = plainToInstance(QueryContentDto, {
      page: '0',
      limit: '101',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
  });
});
