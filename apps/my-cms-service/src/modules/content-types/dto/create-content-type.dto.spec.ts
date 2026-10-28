import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateContentTypeDto,
  FieldDefinitionDto,
} from './create-content-type.dto.js';

describe('CreateContentTypeDto', () => {
  it('should transform and validate nested fields correctly', async () => {
    const raw = {
      key: 'article',
      name: 'Article',
      fields: [
        {
          key: 'title',
          label: 'Title',
          type: 'text',
          required: true,
        },
      ],
    };

    const dto = plainToInstance(CreateContentTypeDto, raw);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
    expect(dto.fields[0]).toBeInstanceOf(FieldDefinitionDto);
    expect(dto.fields[0].key).toBe('title');
    expect(dto.fields[0].type).toBe('text');
    expect(dto.fields[0].required).toBe(true);
  });
});
