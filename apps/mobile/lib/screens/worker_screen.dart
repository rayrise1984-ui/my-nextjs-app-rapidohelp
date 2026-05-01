import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/service_visuals.dart';
import '../models/support_models.dart';
import 'worker_profile_setup_screen.dart';

const helperBackgroundCheckConsentVersion = 'helper_background_check_v1';

bool _isFilledValue(Object? value) => value != null && value.toString().trim().isNotEmpty;

bool _isTwoLetterStateCode(Object? value) {
  return RegExp(r'^[A-Z]{2}$').hasMatch(value?.toString().trim().toUpperCase() ?? '');
}

bool isCompleteWorkerBackgroundCheck(Map<String, dynamic>? row) {
  if (row == null) return false;

  return _isFilledValue(row['submitted_at']) &&
      _isFilledValue(row['legal_full_name']) &&
      RegExp(r'^\d{4}$').hasMatch((row['ssn_last4'] as String? ?? '').trim()) &&
      _isFilledValue(row['driver_license_number']) &&
      _isTwoLetterStateCode(row['driver_license_state']) &&
      _isFilledValue(row['legal_address_line1']) &&
      _isFilledValue(row['legal_city']) &&
      _isTwoLetterStateCode(row['legal_state']) &&
      _isFilledValue(row['legal_postal_code']) &&
      _isFilledValue(row['payout_account_holder_name']) &&
      _isFilledValue(row['payout_bank_name']) &&
      ['checking', 'savings'].contains((row['payout_account_type'] as String? ?? '').trim().toLowerCase()) &&
      RegExp(r'^\d{4}$').hasMatch((row['payout_account_last4'] as String? ?? '').trim()) &&
      RegExp(r'^\d{4}$').hasMatch((row['payout_routing_last4'] as String? ?? '').trim());
}

String _formatScheduledFor(DateTime? scheduledFor) {
  if (scheduledFor == null) return 'Schedule pending';
  final local = scheduledFor.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}-$month-$day $hour:$minute';
}

String _bookingPaymentLabel(String? method) {
  switch (method) {
    case 'card':
      return 'Pay by card';
    case 'upi':
      return 'Pay by UPI';
    case 'cash':
      return 'Pay with cash';
    default:
      return 'Payment preference pending';
  }
}

class WorkerScreen extends StatefulWidget {
  const WorkerScreen({super.key});

  @override
  State<WorkerScreen> createState() => _WorkerScreenState();
}

class _WorkerScreenState extends State<WorkerScreen> {
  bool _profileCheckLoading = true;
  bool _profileComplete = false;
  List<Job> _pendingJobs = [];
  List<Job> _acceptedJobs = [];
  List<Job> _completedJobs = [];
  List<Job> _workHistoryJobs = [];
  List<String> _workerServiceTypes = [];
  Map<String, String> _finalPriceInputs = {};
  bool _loading = true;
  bool _updatingAvailability = false;
  String? _error;
  String? _message;
  String? _acceptingJobId;
  String? _startingJobId;
  String? _cancellingJobId;
  String? _completingJobId;
  String _workerStatus = 'offline';
  bool _workerVerified = false;
  bool _workerDisabled = false;
  double _totalEarnings = 0;
  RealtimeChannel? _channel;
  RealtimeChannel? _profileChannel;

  bool get _workerCanAcceptJobs =>
      _profileComplete && _workerVerified && !_workerDisabled;

  @override
  void initState() {
    super.initState();
    _checkProfileAndInit();
  }

  Future<void> _checkProfileAndInit() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) {
      setState(() {
        _profileCheckLoading = false;
        _profileComplete = false;
      });
      return;
    }
    final row = await Supabase.instance.client
        .from('profiles')
        .select(
          'worker_status, worker_work_details, worker_experience_years, worker_profile_completed, service_types, total_earnings, worker_verified, worker_disabled, worker_background_check_consent_at, worker_background_check_consent_platform, worker_background_check_consent_version',
        )
        .eq('id', userId)
        .maybeSingle();
    final status = row?['worker_status'] as String?;
    final workDetails = row?['worker_work_details'] as String?;
    final exp = row?['worker_experience_years'] as int?;
    final completedFlag = (row?['worker_profile_completed'] as bool?) ?? false;
    final services = List<String>.from((row?['service_types'] as List?) ?? const []);
    final totalEarnings = (row?['total_earnings'] as num?)?.toDouble() ?? 0;
    final workerVerified = (row?['worker_verified'] as bool?) ?? false;
    final workerDisabled = (row?['worker_disabled'] as bool?) ?? false;
    final consentSatisfied = (row?['worker_background_check_consent_at'] as String?) != null &&
        (row?['worker_background_check_consent_platform'] as String?) != null &&
        (row?['worker_background_check_consent_version'] as String?) ==
            helperBackgroundCheckConsentVersion;
    final backgroundRow = await Supabase.instance.client
        .from('worker_background_checks')
        .select(
          'submitted_at, legal_full_name, ssn_last4, driver_license_number, driver_license_state, legal_address_line1, legal_address_line2, legal_city, legal_state, legal_postal_code, payout_account_holder_name, payout_bank_name, payout_account_type, payout_account_last4, payout_routing_last4',
        )
        .eq('worker_id', userId)
        .maybeSingle();
    final backgroundComplete = isCompleteWorkerBackgroundCheck(backgroundRow);
    final complete = completedFlag &&
        status != null &&
        status.isNotEmpty &&
        workDetails != null &&
        workDetails.trim().isNotEmpty &&
        exp != null &&
        exp >= 0 &&
        services.isNotEmpty &&
        consentSatisfied &&
        backgroundComplete;
    if (!complete && mounted) {
      final result = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => WorkerProfileSetupScreen(userId: userId),
        ),
      );
      if (result != true && mounted) {
        setState(() {
          _profileCheckLoading = false;
          _profileComplete = false;
        });
        return;
      }
    }
    setState(() {
      _profileCheckLoading = false;
      _profileComplete = true;
    });
    _initialize();
  }

  @override
  void dispose() {
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    if (_profileChannel != null) {
      Supabase.instance.client.removeChannel(_profileChannel!);
    }
    super.dispose();
  }

  Future<void> _initialize() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      if (!mounted) return;
      setState(() => _loading = false);
      return;
    }

    try {
      final profile = await client
          .from('profiles')
          .select('worker_status, service_types, worker_verified, worker_disabled')
          .eq('id', userId)
          .maybeSingle();
      final serviceTypes = List<String>.from((profile?['service_types'] as List?) ?? const []);

      final pendingRows = await client
          .from('jobs')
          .select()
          .eq('status', 'pending')
          .order('created_at', ascending: false);

      final assignments = await client
          .from('job_assignments')
          .select('job_id')
          .eq('worker_id', userId)
          .eq('status', 'accepted');

      List<Job> acceptedJobs = [];
      if ((assignments as List).isNotEmpty) {
        final jobIds = (assignments).map((entry) => entry['job_id']).toList();
        final acceptedRows = await client
            .from('jobs')
            .select()
            .inFilter('id', jobIds)
            .order('created_at', ascending: false);
        acceptedJobs = (acceptedRows as List)
            .map((entry) => Job.fromJson(entry as Map<String, dynamic>))
            .where((job) => job.status == 'accepted' || job.status == 'in_progress')
            .toList();
      }

      final completedRows = await client
          .from('jobs')
          .select()
          .eq('worker_id', userId)
          .eq('status', 'completed')
          .order('completed_at', ascending: false);

      final historyRows = await client
          .from('jobs')
          .select()
          .eq('worker_id', userId)
          .order('created_at', ascending: false);

      if (!mounted) return;

      setState(() {
        _workerStatus = (profile?['worker_status'] as String?) ?? 'offline';
        _workerVerified = workerVerified;
        _workerDisabled = workerDisabled;
        _totalEarnings = totalEarnings;
        _workerServiceTypes = serviceTypes;
        _pendingJobs = (pendingRows as List)
            .map((entry) => Job.fromJson(entry as Map<String, dynamic>))
            .where((job) => serviceTypes.contains(job.serviceType))
            .toList();
        _acceptedJobs = acceptedJobs;
        _completedJobs = (completedRows as List)
            .map((entry) => Job.fromJson(entry as Map<String, dynamic>))
            .toList();
        _workHistoryJobs = (historyRows as List)
            .map((entry) => Job.fromJson(entry as Map<String, dynamic>))
            .toList();
        _finalPriceInputs = {
          for (final job in acceptedJobs)
            job.id: (job.finalPrice ?? job.estimatedPrice ?? 0).toStringAsFixed(2),
        };
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }

    _channel = client.channel('worker-jobs-$userId');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'jobs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'status',
            value: 'pending',
          ),
          callback: (payload) {
            final next = Job.fromJson(payload.newRecord);
            if (!_workerServiceTypes.contains(next.serviceType)) return;
            setState(() {
              _pendingJobs = [next, ..._pendingJobs.where((job) => job.id != next.id)];
              if (next.workerId == userId) {
                _workHistoryJobs = [next, ..._workHistoryJobs.where((job) => job.id != next.id)];
              }
            });
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'jobs',
          callback: (payload) {
            final updated = Job.fromJson(payload.newRecord);
            setState(() {
              _pendingJobs = _pendingJobs.where((job) => job.id != updated.id).toList();
              if (updated.workerId == userId) {
                _workHistoryJobs = [updated, ..._workHistoryJobs.where((job) => job.id != updated.id)];
              } else {
                _workHistoryJobs = _workHistoryJobs.where((job) => job.id != updated.id).toList();
              }
              if (updated.workerId == userId &&
                  (updated.status == 'accepted' || updated.status == 'in_progress')) {
                _acceptedJobs = [updated, ..._acceptedJobs.where((job) => job.id != updated.id)];
                _finalPriceInputs[updated.id] =
                    (updated.finalPrice ?? updated.estimatedPrice ?? 0).toStringAsFixed(2);
              } else {
                _acceptedJobs = _acceptedJobs.where((job) => job.id != updated.id).toList();
                _finalPriceInputs.remove(updated.id);
              }
              if (updated.workerId == userId && updated.status == 'completed') {
                _completedJobs = [updated, ..._completedJobs.where((job) => job.id != updated.id)];
              } else {
                _completedJobs = _completedJobs.where((job) => job.id != updated.id).toList();
              }
            });
          },
        )
        .subscribe();

    _profileChannel = client.channel('worker-profile-$userId');
    _profileChannel!
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'profiles',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: userId,
          ),
          callback: (payload) {
            final nextServices = List<String>.from(
              (payload.newRecord['service_types'] as List?) ?? const [],
            );
            if (!mounted) return;
            setState(() {
              _workerStatus =
                  (payload.newRecord['worker_status'] as String?) ?? 'offline';
              _workerVerified =
                  (payload.newRecord['worker_verified'] as bool?) ?? false;
              _workerDisabled =
                  (payload.newRecord['worker_disabled'] as bool?) ?? false;
              _workerServiceTypes = nextServices;
              _pendingJobs = _pendingJobs
                  .where((job) => nextServices.contains(job.serviceType))
                  .toList();
            });
          },
        )
        .subscribe();
  }

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
  }

  Future<void> _toggleAvailability() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;
    if (_workerStatus == 'on_job' || !_workerCanAcceptJobs) return;

    final nextStatus = _workerStatus == 'online' ? 'offline' : 'online';
    setState(() {
      _updatingAvailability = true;
      _error = null;
    });

    try {
      await Supabase.instance.client
          .from('profiles')
          .update({'worker_status': nextStatus})
          .eq('id', userId);

      if (!mounted) return;
      setState(() {
        _workerStatus = nextStatus;
        _message = nextStatus == 'online'
            ? 'You are online and can accept jobs.'
            : 'You are offline.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to update availability: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _updatingAvailability = false);
      }
    }
  }

  Future<void> _acceptJob(String jobId) async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;
    if (_workerStatus != 'online' || !_workerCanAcceptJobs) return;

    setState(() {
      _acceptingJobId = jobId;
      _error = null;
      _message = null;
    });

    try {
      final client = Supabase.instance.client;
      final updated = await client.rpc(
        'accept_job',
        params: {'p_job_id': jobId},
      );

      if (!mounted) return;

      final acceptedJob = Job.fromJson(jsonObjectFromRpc(updated));
      setState(() {
        _pendingJobs = _pendingJobs.where((job) => job.id != jobId).toList();
        _acceptedJobs = [acceptedJob, ..._acceptedJobs.where((job) => job.id != jobId)];
        _workHistoryJobs = [acceptedJob, ..._workHistoryJobs.where((job) => job.id != acceptedJob.id)];
        _finalPriceInputs[jobId] =
            (acceptedJob.finalPrice ?? acceptedJob.estimatedPrice ?? 0).toStringAsFixed(2);
        _workerStatus = 'on_job';
        _message = 'Job accepted. Set final price when work is done.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to accept job: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _acceptingJobId = null);
      }
    }
  }

  Future<void> _startJob(String jobId) async {
    setState(() {
      _startingJobId = jobId;
      _error = null;
      _message = null;
    });

    try {
      final updated = await Supabase.instance.client.rpc(
        'start_job',
        params: {'p_job_id': jobId},
      );

      if (!mounted) return;
      final activeJob = Job.fromJson(jsonObjectFromRpc(updated));
      setState(() {
        _acceptedJobs = [activeJob, ..._acceptedJobs.where((job) => job.id != jobId)];
        _workHistoryJobs = [activeJob, ..._workHistoryJobs.where((job) => job.id != activeJob.id)];
        _workerStatus = 'on_job';
        _message = 'Job marked in progress.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to start job: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _startingJobId = null);
      }
    }
  }

  Future<void> _cancelWorkerJob(String jobId) async {
    setState(() {
      _cancellingJobId = jobId;
      _error = null;
      _message = null;
    });

    try {
      final updated = await Supabase.instance.client.rpc(
        'cancel_worker_job',
        params: {'p_job_id': jobId},
      );

      if (!mounted) return;
      final cancelledJob = Job.fromJson(jsonObjectFromRpc(updated));
      setState(() {
        _acceptedJobs = _acceptedJobs.where((job) => job.id != jobId).toList();
        _workHistoryJobs = [cancelledJob, ..._workHistoryJobs.where((job) => job.id != cancelledJob.id)];
        _finalPriceInputs.remove(jobId);
        _workerStatus = 'online';
        _message = 'Job cancelled.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to cancel job: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _cancellingJobId = null);
      }
    }
  }

  Future<void> _completeJob(String jobId) async {
    if (Supabase.instance.client.auth.currentUser == null) return;

    final finalPrice = double.tryParse(_finalPriceInputs[jobId] ?? '');
    if (finalPrice == null || finalPrice <= 0) {
      setState(() {
        _error = 'Enter a valid final price before marking complete.';
      });
      return;
    }

    setState(() {
      _completingJobId = jobId;
      _error = null;
      _message = null;
    });

    try {
      final updated = await Supabase.instance.client.rpc(
        'complete_job',
        params: {
          'p_job_id': jobId,
          'p_final_price': finalPrice,
        },
      );

      if (!mounted) return;
      final completedJob = Job.fromJson(jsonObjectFromRpc(updated));

      setState(() {
        _acceptedJobs = _acceptedJobs.where((job) => job.id != jobId).toList();
        _completedJobs = [completedJob, ..._completedJobs.where((job) => job.id != jobId)];
        _workHistoryJobs = [completedJob, ..._workHistoryJobs.where((job) => job.id != completedJob.id)];
        _finalPriceInputs.remove(jobId);
        _workerStatus = 'online';
        _message = 'Job completed. Waybill is available from the worker web dashboard.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to complete job: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _completingJobId = null);
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return const Color(0xFFE65100);
      case 'accepted':
        return const Color(0xFF1565C0);
      case 'in_progress':
        return const Color(0xFFF77F00);
      case 'completed':
        return const Color(0xFF2E7D32);
      case 'cancelled_by_worker':
        return const Color(0xFF8A1C0F);
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_profileCheckLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_profileComplete) {
      return const Scaffold(
        body: Center(child: Text('Worker profile setup required.')), // fallback
      );
    }
    final totalEarnings = _totalEarnings;
    final pendingPayout = _completedJobs
        .where((job) => job.paymentStatus != 'paid')
        .fold<double>(0, (sum, job) => sum + (job.effectiveWorkerPayoutAmount ?? 0));
    final workHistoryJobs = _workHistoryJobs;
    final serviceSummary = _workerServiceTypes
        .map((type) => serviceVisualFor(type).label)
        .join(', ');
    final currentUserId = Supabase.instance.client.auth.currentUser?.id;
    final offeredJobs = _workerCanAcceptJobs && currentUserId != null
        ? _pendingJobs.where((job) => job.preferredWorkerId == currentUserId).toList()
        : const <Job>[];
    final matchingJobs = _workerCanAcceptJobs && currentUserId != null
        ? _pendingJobs.where((job) => job.preferredWorkerId != currentUserId).toList()
        : const <Job>[];
    final accessReady = _workerVerified && !_workerDisabled;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Worker Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: _signOut,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Availability',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _workerDisabled
                              ? 'Worker access is paused by staff.'
                              : !_workerVerified
                                  ? 'Your profile is waiting for staff approval before you can go online.'
                                  : _workerStatus == 'online'
                                      ? 'Online and ready to accept jobs.'
                                      : _workerStatus == 'on_job'
                                          ? 'On job. Finish or cancel the active job before taking another.'
                                          : 'Offline. Toggle on to start accepting jobs.',
                        ),
                        if (serviceSummary.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Services: $serviceSummary',
                            style: const TextStyle(fontSize: 13, color: Colors.grey),
                          ),
                        ],
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: _updatingAvailability ||
                                  _workerStatus == 'on_job' ||
                                  !_workerCanAcceptJobs
                              ? null
                              : _toggleAvailability,
                          child: Text(
                            _workerDisabled
                                ? 'Paused'
                                : !_workerVerified
                                    ? 'Pending Review'
                                    : _workerStatus == 'online'
                                        ? 'Go Offline'
                                        : 'Go Online',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (!_workerVerified || _workerDisabled)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        _workerDisabled
                            ? 'Staff has paused this helper account. Review your earnings and history here, and contact support if you need to restore access.'
                            : 'Your helper profile is complete and waiting for staff approval before new jobs unlock.',
                      ),
                    ),
                  ),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Earnings',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text('Total earnings: \$${totalEarnings.toStringAsFixed(2)}'),
                        Text('Pending payout: \$${pendingPayout.toStringAsFixed(2)}'),
                        Text('Completed jobs: ${_completedJobs.length}'),
                        Text('Work history items: ${workHistoryJobs.length}'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Work history',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        if (workHistoryJobs.isEmpty)
                          const Text('No work history yet.')
                        else
                          ...workHistoryJobs.map((job) {
                            final visual = serviceVisualFor(job.serviceType);
                            final double payoutAmount =
                                job.workerPayoutAmount ?? job.effectiveWorkerPayoutAmount ?? 0.0;
                            final payoutLabel = job.status == 'completed'
                                ? job.paymentStatus == 'paid'
                                    ? 'Earned \$${payoutAmount.toStringAsFixed(2)}'
                                    : 'Pending payout \$${payoutAmount.toStringAsFixed(2)}'
                                : job.status == 'cancelled_by_worker'
                                    ? 'No payout'
                                    : payoutAmount > 0
                                        ? 'Potential payout \$${payoutAmount.toStringAsFixed(2)}'
                                        : 'Payout pending';
                            final timestamp = job.completedAt ?? job.acceptedAt ?? job.createdAt;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: const Color(0xFFD9DEE8)),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(child: Text(visual.label, style: const TextStyle(fontWeight: FontWeight.w600))),
                                        Chip(
                                          label: Text(job.status.replaceAll('_', ' ')),
                                          backgroundColor: _statusColor(job.status),
                                          labelStyle: const TextStyle(color: Colors.white),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(job.description),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Address: ${job.serviceAddress ?? job.locationName ?? 'Location pending'}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'When: ${_formatScheduledFor(job.scheduledFor)}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${job.status == 'completed' ? 'Completed' : job.status == 'in_progress' ? 'In progress' : job.status == 'accepted' ? 'Accepted' : 'Cancelled'} ${timestamp.toLocal()}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Payment: ${_bookingPaymentLabel(job.bookingPaymentMethod)}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      payoutLabel,
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Payment: ${job.paymentStatus.replaceAll('_', ' ')}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
                if (_message != null) ...[
                  const SizedBox(height: 12),
                  Text(_message!, style: const TextStyle(color: Color(0xFF1B5E20))),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Color(0xFF8A1C0F))),
                ],
                if (offeredJobs.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('Offered to you', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  ...offeredJobs.map((job) {
                    final visual = serviceVisualFor(job.serviceType);
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                ServiceAvatar(serviceType: job.serviceType, size: 40),
                                const SizedBox(width: 10),
                                Expanded(child: Text(visual.label)),
                                const Chip(
                                  label: Text('Preferred'),
                                  backgroundColor: Color(0xFF0057FF),
                                  labelStyle: const TextStyle(color: Colors.white),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(job.description),
                            const SizedBox(height: 4),
                            Text('Address: ${job.serviceAddress ?? job.locationName ?? 'Location pending'}'),
                            const SizedBox(height: 4),
                            Text('When: ${_formatScheduledFor(job.scheduledFor)}'),
                            const SizedBox(height: 4),
                            Text('Payment: ${_bookingPaymentLabel(job.bookingPaymentMethod)}'),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: _acceptingJobId == job.id || _workerStatus != 'online' || !_workerCanAcceptJobs
                                  ? null
                                  : () => _acceptJob(job.id),
                              child: Text(
                                _acceptingJobId == job.id
                                    ? 'Please wait...'
                                    : !_workerCanAcceptJobs
                                        ? 'Review Pending'
                                        : _workerStatus != 'online'
                                        ? 'Go online'
                                        : 'Accept',
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
                if (accessReady) ...[
                  const SizedBox(height: 16),
                  Text('Active jobs', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (_acceptedJobs.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No active jobs yet.'),
                      ),
                    )
                  else
                    ..._acceptedJobs.map((job) {
                      final visual = serviceVisualFor(job.serviceType);
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  ServiceAvatar(serviceType: job.serviceType, size: 40),
                                  const SizedBox(width: 10),
                                  Expanded(child: Text(visual.label)),
                                  Chip(
                                    label: Text(job.status.replaceAll('_', ' ')),
                                    backgroundColor: _statusColor(job.status),
                                    labelStyle: const TextStyle(color: Colors.white),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(job.description),
                              const SizedBox(height: 6),
                              Text('Address: ${job.serviceAddress ?? job.locationName ?? 'Location pending'}'),
                              const SizedBox(height: 4),
                              Text('When: ${_formatScheduledFor(job.scheduledFor)}'),
                              const SizedBox(height: 4),
                              Text('Payment: ${_bookingPaymentLabel(job.bookingPaymentMethod)}'),
                              const SizedBox(height: 12),
                              if (job.status == 'accepted') ...[
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: FilledButton(
                                        onPressed: _startingJobId == job.id
                                            ? null
                                            : () => _startJob(job.id),
                                        child: Text(
                                          _startingJobId == job.id
                                              ? 'Updating...'
                                              : 'Mark Arrived',
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: _cancellingJobId == job.id
                                            ? null
                                            : () => _cancelWorkerJob(job.id),
                                        child: Text(
                                          _cancellingJobId == job.id
                                              ? 'Cancelling...'
                                              : 'Cancel',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ] else ...[
                                TextFormField(
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  initialValue: _finalPriceInputs[job.id] ??
                                      (job.finalPrice ?? job.estimatedPrice ?? 0).toStringAsFixed(2),
                                  decoration: const InputDecoration(
                                    labelText: 'Final price for customer',
                                    prefixText: '\$',
                                    border: OutlineInputBorder(),
                                  ),
                                  onChanged: (value) {
                                    setState(() {
                                      _finalPriceInputs[job.id] = value;
                                    });
                                  },
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: FilledButton(
                                        onPressed: _completingJobId == job.id
                                            ? null
                                            : () => _completeJob(job.id),
                                        child: Text(
                                          _completingJobId == job.id
                                              ? 'Completing...'
                                              : 'Mark Complete',
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: _cancellingJobId == job.id
                                            ? null
                                            : () => _cancelWorkerJob(job.id),
                                        child: Text(
                                          _cancellingJobId == job.id
                                              ? 'Cancelling...'
                                              : 'Cancel',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 16),
                  Text('Matching jobs', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (matchingJobs.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No matching jobs right now.'),
                      ),
                    )
                  else
                    ...matchingJobs.map((job) {
                      final visual = serviceVisualFor(job.serviceType);
                      return Card(
                        child: ListTile(
                          leading: ServiceAvatar(serviceType: job.serviceType),
                          title: Text(visual.label),
                          subtitle: Text(
                            [
                              job.description,
                              if (job.estimatedPrice != null)
                                'Estimate: \$${job.estimatedPrice!.toStringAsFixed(2)}',
                              if (job.serviceAddress != null) 'Address: ${job.serviceAddress}',
                              if (job.scheduledFor != null) 'When: ${_formatScheduledFor(job.scheduledFor)}',
                              'Payment: ${_bookingPaymentLabel(job.bookingPaymentMethod)}',
                            ].join('\n'),
                          ),
                          trailing: FilledButton.tonal(
                            onPressed: _acceptingJobId == job.id ||
                                    _workerStatus != 'online' ||
                                    !_workerCanAcceptJobs
                                ? null
                                : () => _acceptJob(job.id),
                            child: Text(
                              _acceptingJobId == job.id
                                  ? 'Please wait...'
                                  : !_workerCanAcceptJobs
                                      ? 'Review Pending'
                                      : _workerStatus != 'online'
                                      ? 'Go online'
                                      : 'Accept',
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ],
            ),
    );
  }
}
