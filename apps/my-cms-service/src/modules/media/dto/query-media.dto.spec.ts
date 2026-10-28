import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryMediaDto } from './query-media.dto.js';

describe('QueryMediaDto', () => {
  it('passes validation with empty optional params', async () => {
    const dto = plainToInstance(QueryMediaDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes validation with valid numeric query params', async () => {
    const dto = plainToInstance(QueryMediaDto, {
      page: '3',
      limit: '50',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('fails when page is less than 1 or limit exceeds 100', async () => {
    const dto = plainToInstance(QueryMediaDto, {
      page: -1,
      limit: 105,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
  });
});
