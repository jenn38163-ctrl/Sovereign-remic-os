/**
 * CUSIP & ISIN Authoritative Checksum Validation Rules
 */

export function validateCusip(cusip: string): boolean {
  if (!cusip || typeof cusip !== 'string' || cusip.length !== 9) {
    return false;
  }
  // CUSIP format: 6 alphanumeric issuer code, 2 alphanumeric issue number, 1 numeric check digit
  const upper = cusip.toUpperCase();
  const chars = upper.split('');
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const c = chars[i];
    let val = 0;
    if (c >= '0' && c <= '9') {
      val = parseInt(c, 10);
    } else if (c >= 'A' && c <= 'Z') {
      val = c.charCodeAt(0) - 55; // A=10, B=11, ... Z=35
    } else if (c === '*') {
      val = 36;
    } else if (c === '@') {
      val = 37;
    } else if (c === '#') {
      val = 38;
    } else {
      return false;
    }

    if (i % 2 === 1) {
      val *= 2;
    }
    sum += Math.floor(val / 10) + (val % 10);
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = parseInt(chars[8], 10);
  return expectedCheckDigit === actualCheckDigit;
}

export function validateIsin(isin: string): boolean {
  if (!isin || typeof isin !== 'string' || isin.length !== 12) {
    return false;
  }
  const upper = isin.toUpperCase();
  // First 2 chars must be letters (country code)
  if (!/^[A-Z]{2}$/.test(upper.substring(0, 2))) {
    return false;
  }
  // Last char must be a digit
  if (!/^[0-9]$/.test(upper.substring(11, 12))) {
    return false;
  }

  // Convert letters to numbers (A=10 ... Z=35)
  let numericStr = '';
  for (let i = 0; i < 11; i++) {
    const c = upper[i];
    if (c >= '0' && c <= '9') {
      numericStr += c;
    } else if (c >= 'A' && c <= 'Z') {
      numericStr += (c.charCodeAt(0) - 55).toString();
    } else {
      return false;
    }
  }

  // Luhn algorithm over numeric string
  let sum = 0;
  let double = true;
  for (let i = numericStr.length - 1; i >= 0; i--) {
    let digit = parseInt(numericStr[i], 10);
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = parseInt(upper[11], 10);
  return expectedCheckDigit === actualCheckDigit;
}
