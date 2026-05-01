export const ADMIN_LOGIN_EMAIL = "helpdesk@rapidohelp.com";

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === ADMIN_LOGIN_EMAIL;
}
