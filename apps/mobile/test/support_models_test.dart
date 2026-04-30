import 'package:flutter_test/flutter_test.dart';
import 'package:rapidohelp_mobile/models/support_models.dart';

Map<String, dynamic> jobJson(Map<String, dynamic> overrides) {
  return {
    'id': 'job-1',
    'user_id': 'user-1',
    'worker_id': null,
    'service_type': 'flat_tire',
    'description': 'Flat tire near downtown',
    'location_lat': 38.294,
    'location_lng': -122.286,
    'location_name': 'Downtown',
    'status': 'pending',
    'estimated_price': 45,
    'final_price': null,
    'payment_status': 'unpaid',
    'payment_method': null,
    'payment_reference': null,
    'paid_at': null,
    'company_fee_amount': null,
    'worker_payout_amount': null,
    'created_at': '2026-04-27T12:00:00.000Z',
    'accepted_at': null,
    'completed_at': null,
    'updated_at': '2026-04-27T12:00:00.000Z',
    ...overrides,
  };
}

void main() {
  group('Job model', () {
    test('maps database JSON and applies defaults', () {
      final job = Job.fromJson(jobJson({'payment_status': null}));

      expect(job.id, 'job-1');
      expect(job.userId, 'user-1');
      expect(job.serviceType, 'flat_tire');
      expect(job.paymentStatus, 'unpaid');
      expect(job.payableAmount, 45);
      expect(job.effectiveCompanyFeeAmount, 9);
      expect(job.effectiveWorkerPayoutAmount, 36);
    });

    test('uses final price and stored payout fields when present', () {
      final job = Job.fromJson(jobJson({
        'status': 'completed',
        'final_price': 55.75,
        'company_fee_amount': 11.15,
        'worker_payout_amount': 44.60,
      }));

      expect(job.payableAmount, 55.75);
      expect(job.effectiveCompanyFeeAmount, 11.15);
      expect(job.effectiveWorkerPayoutAmount, 44.60);
    });

    test('copyWith updates mutable fields without changing identity', () {
      final job = Job.fromJson(jobJson({}));
      final updated = job.copyWith(
        status: 'accepted',
        workerId: 'worker-1',
        paymentStatus: 'paid',
        paymentMethod: 'card',
      );

      expect(updated.id, job.id);
      expect(updated.status, 'accepted');
      expect(updated.workerId, 'worker-1');
      expect(updated.paymentStatus, 'paid');
      expect(updated.paymentMethod, 'card');
    });
  });

  group('WorkerRating model', () {
    test('maps database JSON', () {
      final rating = WorkerRating.fromJson({
        'id': 'rating-1',
        'job_id': 'job-1',
        'from_user_id': 'customer-1',
        'to_worker_id': 'worker-1',
        'rating': 5,
        'comment': 'Great help',
        'created_at': '2026-04-27T12:00:00.000Z',
      });

      expect(rating.jobId, 'job-1');
      expect(rating.toWorkerId, 'worker-1');
      expect(rating.rating, 5);
      expect(rating.comment, 'Great help');
    });
  });

  group('payout helpers', () {
    test('calculates marketplace payout split', () {
      final split = calculatePayoutSplit(45.55);

      expect(split.companyFeeAmount, 9.11);
      expect(split.workerPayoutAmount, 36.44);
    });

    test('normalizes RPC object payloads', () {
      expect(jsonObjectFromRpc({'id': 'job-1'}), {'id': 'job-1'});
      expect(jsonObjectFromRpc([
        {'id': 'job-2'}
      ]), {'id': 'job-2'});
      expect(() => jsonObjectFromRpc([]), throwsFormatException);
    });
  });
}
