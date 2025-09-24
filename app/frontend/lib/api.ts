export const getCSRFToken = (): string => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!token) {
    throw new Error('CSRF token not found');
  }
  return token;
};