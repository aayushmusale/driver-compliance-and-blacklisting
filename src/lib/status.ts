// License status, blacklist status and eligibility are deliberately separate concepts (brief section 7).
export const WARNING_DAYS = 60; // confirmed: alert 60 days before expiry

export type LicenseStatus = "VALID" | "EXPIRING" | "EXPIRED" | "PENDING";

export function daysLeft(expiry?: string | null): number | null {
  if (!expiry) return null;
  const t = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((new Date(expiry + "T00:00:00Z").getTime() - t) / 86400000);
}

export function licenseStatus(l: { expiry?: string | null; verified?: number | null } | null | undefined): LicenseStatus {
  if (!l || !l.verified || !l.expiry) return "PENDING";
  const d = daysLeft(l.expiry)!;
  if (d < 0) return "EXPIRED";
  if (d <= WARNING_DAYS) return "EXPIRING";
  return "VALID";
}

export const LICENSE_LABEL: Record<LicenseStatus, string> = {
  VALID: "Valid", EXPIRING: "Expiring soon", EXPIRED: "Expired", PENDING: "Pending verification",
};

// Eligibility is driven by blacklisting only (an expired license is highlighted for action, per brief 7.3).
export const isEligible = (blacklisted: number | boolean) => !blacklisted;

// A license number is exactly 15 characters, letters and digits only.
// and it must contain at least one letter AND at least one digit.
export const LICENSE_NO_MSG = "License number must be exactly 15 characters: letters and digits only.";
export const LICENSE_NO_HTML_PATTERN = "(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{15}"; // same rule for the browser's own validation
export const LICENSE_NO_TITLE = "Exactly 15 characters, letters and digits only, with at least one letter and one digit";

/** Returns the reason a license number is invalid, or null when it is valid. */
export function licenseNoError(n: string): string | null {
  if (!/^[A-Za-z0-9]{15}$/.test(n)) return LICENSE_NO_MSG;
  if (!/[A-Za-z]/.test(n)) return "License number must contain at least one letter (alphabet). Digits alone are not allowed.";
  if (!/[0-9]/.test(n)) return "License number must contain at least one digit (number). Letters alone are not allowed.";
  return null;
}
export const isValidLicenseNo = (n: string) => licenseNoError(n) === null;

export const maskLicense = (n?: string | null) => (n ? "•••• " + n.slice(-4) : "—");
