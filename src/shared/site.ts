// Who runs this copy of the site and how to reach them. Shown on the contact page, the privacy
// policy and the terms.
//
// Set in .env.production (see .env.production.example), never in code: someone deploying their
// own copy must not end up publishing legal pages that name somebody else. A value left empty
// is simply not shown; the legal pages need at least a name and an email to be worth publishing.

const env = import.meta.env;

export const OPERATOR = {
  /** Full name of the person or organisation responsible for the site. */
  name: env.VITE_OPERATOR_NAME ?? "",
  /** Postal address, if your country's rules require one. */
  address: env.VITE_OPERATOR_ADDRESS ?? "",
  /** Country whose law governs the terms, e.g. "Hungary". */
  country: env.VITE_OPERATOR_COUNTRY ?? "",
  /** Data protection authority to name in the privacy policy, e.g. "NAIH (naih.hu)". */
  authority: env.VITE_OPERATOR_AUTHORITY ?? "",
  /** Public contact address, also used for privacy requests. */
  email: env.VITE_OPERATOR_EMAIL ?? "",
  /** GitHub username. */
  github: env.VITE_OPERATOR_GITHUB ?? "",
  /** Full LinkedIn profile URL. */
  linkedin: env.VITE_OPERATOR_LINKEDIN ?? "",
};

/** Shown as "Last updated" on the privacy policy and terms. Change it whenever their text changes. */
export const LEGAL_UPDATED = "13 November 2026";
