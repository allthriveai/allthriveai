// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (minimum 8 characters)
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Validate email with error message
export function validateEmail(email: string): string | undefined {
  if (!email) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Invalid email format';
  }
  return undefined;
}

// Validate password with error message
export function validatePassword(password: string): string | undefined {
  if (!password) {
    return 'Password is required';
  }
  if (!isValidPassword(password)) {
    return 'Password must be at least 8 characters';
  }
  return undefined;
}
