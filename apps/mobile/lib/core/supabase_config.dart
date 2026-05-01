class SupabaseConfig {
  static const url = String.fromEnvironment("SUPABASE_URL");
  static const anonKey = String.fromEnvironment("SUPABASE_ANON_KEY");
  static const smtpUser = String.fromEnvironment("SMTP_USER");
  static const smtpPass = String.fromEnvironment("SMTP_PASS");
  static const devCustomerEmail = String.fromEnvironment("DEV_CUSTOMER_EMAIL");
  static const devCustomerPassword = String.fromEnvironment(
    "DEV_CUSTOMER_PASSWORD",
  );
  static const devWorkerEmail = String.fromEnvironment("DEV_WORKER_EMAIL");
  static const devWorkerPassword = String.fromEnvironment("DEV_WORKER_PASSWORD");

  static bool get isConfigured => url.isNotEmpty && anonKey.isNotEmpty;

  static bool get hasDevCustomerLogin =>
      devCustomerEmail.isNotEmpty && devCustomerPassword.isNotEmpty;

  static bool get hasSmtpWorkerLogin =>
      smtpUser.isNotEmpty && smtpPass.isNotEmpty;

  static bool get hasDevWorkerLogin =>
      devWorkerEmail.isNotEmpty && devWorkerPassword.isNotEmpty;

  static bool get hasWorkerLogin => hasSmtpWorkerLogin || hasDevWorkerLogin;

  static String get workerLoginEmail =>
      hasSmtpWorkerLogin ? smtpUser : devWorkerEmail;

  static String get workerLoginPassword =>
      hasSmtpWorkerLogin ? smtpPass : devWorkerPassword;

  static String get workerLoginName =>
      hasSmtpWorkerLogin ? 'helpdesk worker' : 'demo worker';

  static String get workerLoginButtonText =>
      hasSmtpWorkerLogin
          ? 'Continue as Helpdesk Worker'
          : 'Continue as Demo Worker';
}
