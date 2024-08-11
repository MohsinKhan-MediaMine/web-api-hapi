export const validateSort = (field: string, value: string) =>
  ['id', 'name', 'first_name'].includes(field) && ['asc', 'desc'].includes(value);
