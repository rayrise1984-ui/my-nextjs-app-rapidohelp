class SupabaseConfig {
  static const url = String.fromEnvironment("SUPABASE_URL");
  static const anonKey = String.fromEnvironment("SUPABASE_ANON_KEY");
  static const devCustomerEmail = String.fromEnvironment("DEV_CUSTOMER_EMAIL");
  static const devCustomerPassword = String.fromEnvironment(
    "DEV_CUSTOMER_PASSWORD",
  );
  static const devWorkerEmail = String.fromEnvironment("DEV_WORKER_EMAIL");
  static const devWorkerPassword = String.fromEnvironment("DEV_WORKER_PASSWORD");

  static bool get isConfigured => url.isNotEmpty && anonKey.isNotEmpty;

  static bool get hasDevCustomerLogin =>
      devCustomerEmail.isNotEmpty && devCustomerPassword.isNotEmpty;

  static bool get hasDevWorkerLogin =>
      devWorkerEmail.isNotEmpty && devWorkerPassword.isNotEmpty;
}