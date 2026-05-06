/**
 * Validates a Brazilian CPF number using the official algorithm.
 * Returns true if the CPF is valid.
 */
export function validateCpf(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Reject all-same-digit CPFs (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === parseInt(digits[10]);
}

/**
 * Validates a Brazilian CNPJ number using the official algorithm.
 * Returns true if the CNPJ is valid.
 */
export function validateCnpj(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  // Reject all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(digits[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(digits[13]) === d2;
}

/**
 * Validates a CPF (11 digits) or CNPJ (14 digits).
 * Returns { valid, error } where error is a user-friendly message.
 */
export function validateCpfCnpj(input: string): { valid: boolean; error: string } {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) {
    return { valid: false, error: "Informe o CPF ou CNPJ" };
  }

  if (digits.length <= 11) {
    if (digits.length !== 11) {
      return { valid: false, error: "CPF deve ter 11 dígitos" };
    }
    if (!validateCpf(digits)) {
      return { valid: false, error: "CPF inválido" };
    }
    return { valid: true, error: "" };
  }

  if (digits.length !== 14) {
    return { valid: false, error: "CNPJ deve ter 14 dígitos" };
  }
  if (!validateCnpj(digits)) {
    return { valid: false, error: "CNPJ inválido" };
  }
  return { valid: true, error: "" };
}

/**
 * Validates a Brazilian phone number (10-11 digits after removing non-digits).
 */
export function validatePhone(input: string): { valid: boolean; error: string } {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    return { valid: false, error: "Informe um telefone válido com DDD" };
  }
  // DDD must be 11-99
  const ddd = parseInt(digits.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valid: false, error: "DDD inválido" };
  }
  return { valid: true, error: "" };
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function validateEmail(input: string): { valid: boolean; error: string } {
  const email = normalizeEmail(input);
  if (!email) return { valid: false, error: "Informe seu e-mail" };
  if (email.length > 254) return { valid: false, error: "E-mail muito longo" };
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? { valid: true, error: "" } : { valid: false, error: "Informe um e-mail válido" };
}

export function validateFullName(input: string): { valid: boolean; error: string } {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return { valid: false, error: "Informe seu nome completo" };
  if (normalized.length < 5) return { valid: false, error: "Informe nome e sobrenome" };
  if (normalized.length > 120) return { valid: false, error: "Nome muito longo" };
  const parts = normalized.split(" ");
  if (parts.length < 2 || parts.some((part) => part.length < 2)) {
    return { valid: false, error: "Informe nome e sobrenome" };
  }
  return { valid: true, error: "" };
}

export function validatePassword(input: string): { valid: boolean; error: string } {
  const password = input.trim();
  if (password.length < 6) return { valid: false, error: "A senha deve ter no mínimo 6 caracteres" };
  if (password.length > 72) return { valid: false, error: "A senha está muito longa" };
  return { valid: true, error: "" };
}
