import {
  validateContentData,
  FieldDefinition,
} from './content-validation.util.js';

describe('validateContentData', () => {
  const fields: FieldDefinition[] = [
    { key: 'title', type: 'text', label: 'Title', required: true },
    { key: 'count', type: 'number', label: 'Count', required: false },
    {
      key: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      options: ['active', 'inactive'],
    },
  ];

  it('should pass valid data', () => {
    const data = { title: 'Hello', count: 5, status: 'active' };
    expect(() => validateContentData(fields, data)).not.toThrow();
  });

  it('should throw if required field is missing', () => {
    const data = { count: 5, status: 'active' };
    expect(() => validateContentData(fields, data)).toThrow(/Title.*required/);
  });

  it('should throw if number field is not a number', () => {
    const data = { title: 'Hello', count: 'not-a-number', status: 'active' };
    expect(() => validateContentData(fields, data)).toThrow(/Count.*number/);
  });

  it('should throw if select value is not in options', () => {
    const data = { title: 'Hello', status: 'invalid-option' };
    expect(() => validateContentData(fields, data)).toThrow(
      /not in allowed options/,
    );
  });
});
