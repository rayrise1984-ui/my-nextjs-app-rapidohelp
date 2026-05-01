export const TERMS_VERSION = "2026-05-01";
export const TERMS_EFFECTIVE_DATE = "May 1, 2026";
export const CONTACT_EMAIL = "helpdesk@rapidohelp.com";

export const termsSections = [
  {
    title: "Agreement",
    body:
      "These Terms of Service are a binding agreement between you and RapidoHelp. By creating an account, signing in, posting a job, accepting a job, using the website or mobile app, or clicking I agree, you agree to these Terms.",
  },
  {
    title: "Eligibility",
    body:
      "You must be at least 18 years old and legally able to enter into a contract in the United States. You agree to provide accurate account information and keep your login credentials secure.",
  },
  {
    title: "Platform Role",
    body:
      "RapidoHelp operates an online service platform that connects customers seeking help with independent workers. RapidoHelp is not an emergency service, employer, roadside assistance carrier, repair shop, medical provider, transportation company, or insurer.",
  },
  {
    title: "Emergency and Safety Notice",
    body:
      "RapidoHelp is not a substitute for emergency services. If there is danger, injury, fire, crime, medical emergency, or unsafe road condition, call 911 or local emergency services first.",
  },
  {
    title: "Customer Responsibilities",
    body:
      "Customers must provide accurate service details, location information, and pricing information. Customers are responsible for confirming that a worker can perform the requested service safely and legally before work begins.",
  },
  {
    title: "Worker Responsibilities",
    body:
      "Workers must provide accurate profile, experience, service, and availability information. Workers are responsible for any licenses, permits, insurance, tools, vehicle requirements, training, quality, safety, legality, and completion of their services.",
  },
  {
    title: "Payments, Fees, and Payouts",
    body:
      "Customers agree to pay the final price shown or agreed for a completed job, plus applicable taxes, fees, or charges. RapidoHelp may retain a platform fee or commission and may display estimated worker payout amounts. Payment processing may be handled by third-party payment providers. Worker payouts may be delayed, adjusted, reversed, or withheld if payment fails, a job is disputed, fraud is suspected, or law requires it.",
  },
  {
    title: "Cancellations and Disputes",
    body:
      "Cancellation and refund decisions may depend on job status, worker arrival, work performed, payment status, and applicable law. RapidoHelp may review service activity and may correct job statuses, restrict accounts, pause worker access, or issue refunds or credits where appropriate.",
  },
  {
    title: "User Content and Ratings",
    body:
      "You may submit job descriptions, profile details, ratings, comments, and other content. You grant RapidoHelp a non-exclusive, worldwide, royalty-free license to host, use, display, reproduce, and process that content to operate and improve the platform.",
  },
  {
    title: "Prohibited Conduct",
    body:
      "You may not misuse the platform, bypass payments, harass or threaten others, discriminate, impersonate another person, post false information, interfere with the service, scrape or reverse engineer the platform, use the platform for illegal activity, or attempt to access another user's account or data.",
  },
  {
    title: "Communications",
    body:
      "RapidoHelp may send service-related account, booking, payment, safety, support, and worker verification communications. If SMS or phone features are enabled, carrier rates may apply. Service messages may still be sent even if marketing messages are opted out where required by law.",
  },
  {
    title: "Privacy and Data Use",
    body:
      "RapidoHelp collects and uses account, profile, location, job, payment, payout, device, support, verification, and activity information to operate the platform, match customers with workers, process payments and payouts, support background review, prevent fraud, resolve disputes, and comply with law. Authorized staff and admins may review activity records for support, safety, payment, verification, and compliance work. See the Privacy Policy for more detail.",
  },
  {
    title: "No Warranties",
    body:
      "The platform is provided as is and as available. RapidoHelp disclaims warranties to the fullest extent permitted by law and does not guarantee worker performance, customer conduct, job availability, response times, earnings, or uninterrupted service.",
  },
  {
    title: "Liability and Indemnity",
    body:
      "To the fullest extent permitted by law, RapidoHelp will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost data, personal injury, property damage, service failures, user conduct, or third-party actions. You agree to indemnify RapidoHelp for claims arising from your use of the platform, your services, your content, your violation of these Terms, your violation of law, or your interaction with another user.",
  },
  {
    title: "Dispute Resolution",
    body:
      "These Terms are governed by California law and applicable United States federal law. The Federal Arbitration Act governs arbitration. You and RapidoHelp agree to resolve claims through binding individual arbitration after an informal dispute process, except for small claims court and certain injunctive relief. Jury trials and class, collective, consolidated, and representative actions are waived to the fullest extent permitted by law.",
  },
  {
    title: "Changes",
    body:
      "RapidoHelp may update these Terms. If changes are material, RapidoHelp will provide notice or require renewed acceptance. Continued use after updated Terms become effective means you accept the updated Terms.",
  },
] as const;

export const privacySections = [
  {
    title: "Information We Collect",
    body:
      "We collect account details, profile information, service requests, addresses, timing preferences, payment and payout records, background-check and verification data for service partners, support messages, ratings, device details, and usage logs.",
  },
  {
    title: "How We Use Information",
    body:
      "We use information to create and manage accounts, match customers with service partners, process bookings, verify helpers, process payments and payouts, provide support, prevent fraud, investigate abuse, deliver service messages, and comply with law.",
  },
  {
    title: "Internal Access and Activity Review",
    body:
      "Authorized staff and admins can review account, booking, payment, support, verification, and activity records to operate the marketplace, investigate issues, handle refunds or disputes, and maintain safety and compliance.",
  },
  {
    title: "Sharing and Service Providers",
    body:
      "We share relevant data with the other party in a booking, payment processors, communication providers, and verification vendors, and when required by law. We do not sell personal data for money.",
  },
  {
    title: "Retention and Security",
    body:
      "We keep records as long as needed for service operation, tax, dispute, safety, or legal reasons, and we use reasonable safeguards to protect them.",
  },
  {
    title: "Your Choices",
    body:
      "You can update many profile details and communication preferences, though some information is required for login, booking, verification, payment, or payout processing.",
  },
  {
    title: "Contact",
    body: `Questions about this policy can be sent to ${CONTACT_EMAIL}.`,
  },
] as const;

export const fullTermsPath = "/terms";
