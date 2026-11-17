/** Shared signup policy; never apply new-password rules to existing-account sign-in. */
export const PASSWORD_REQUIREMENTS = 'Use 8–128 characters, including at least one uppercase letter, one lowercase letter, one number and one special character (not a space).';
export function validNewPassword(value: unknown): value is string {
 return typeof value === 'string' && value.length >= 8 && value.length <= 128
  && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/u.test(value);
}
