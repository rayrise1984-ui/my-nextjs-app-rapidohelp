import 'package:flutter_test/flutter_test.dart';
import 'package:rapidohelp_mobile/screens/worker_screen.dart';

void main() {
  test('worker background check requires the full submitted profile', () {
    expect(
      isCompleteWorkerBackgroundCheck({
        'submitted_at': '2026-04-30T10:00:00.000Z',
        'legal_full_name': 'Jordan Rivera',
        'ssn_last4': '1234',
        'driver_license_number': 'D1234567',
        'driver_license_state': 'CA',
        'legal_address_line1': '123 Main St',
        'legal_address_line2': 'Apt 4',
        'legal_city': 'Los Angeles',
        'legal_state': 'CA',
        'legal_postal_code': '90001',
        'payout_account_holder_name': 'Jordan Rivera',
        'payout_bank_name': 'First Example Bank',
        'payout_account_type': 'checking',
        'payout_account_last4': '4321',
        'payout_routing_last4': '6789',
      }),
      isTrue,
    );
  });

  test('worker background check fails when payout account details are missing', () {
    expect(
      isCompleteWorkerBackgroundCheck({
        'submitted_at': '2026-04-30T10:00:00.000Z',
        'legal_full_name': 'Jordan Rivera',
        'ssn_last4': '1234',
        'driver_license_number': 'D1234567',
        'driver_license_state': 'CA',
        'legal_address_line1': '123 Main St',
        'legal_city': 'Los Angeles',
        'legal_state': 'CA',
        'legal_postal_code': '90001',
        'payout_account_holder_name': 'Jordan Rivera',
        'payout_bank_name': 'First Example Bank',
        'payout_account_type': 'checking',
        'payout_account_last4': '',
        'payout_routing_last4': '6789',
      }),
      isFalse,
    );
  });
}
