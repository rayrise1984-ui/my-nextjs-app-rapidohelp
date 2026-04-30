import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/support_models.dart';

class JobDetailScreen extends StatefulWidget {
  final Job job;

  const JobDetailScreen({super.key, required this.job});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  late Job _job;
  RealtimeChannel? _channel;
  RealtimeChannel? _workerProfileChannel;
  bool _paying = false;
  bool _cancelling = false;
  bool _ratingSubmitting = false;
  bool _ratingSubmitted = false;
  bool _loadingWorkerProfile = false;
  int _rating = 0;
  String? _ratingError;
  _PublicWorkerProfile? _workerProfile;
  final _ratingCommentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _job = widget.job;
    _initialize();
  }

  @override
  void dispose() {
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    if (_workerProfileChannel != null) {
      Supabase.instance.client.removeChannel(_workerProfileChannel!);
    }
    _ratingCommentController.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    final client = Supabase.instance.client;

    _loadWorkerProfile();

    // Subscribe to real-time job updates
    _channel = client.channel('job-detail-${_job.id}');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'jobs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: _job.id,
          ),
          callback: (payload) {
            final updated = Job.fromJson(payload.newRecord);
            final workerChanged = updated.workerId != _job.workerId;
            if (mounted) {
              setState(() => _job = updated);
            }
            if (workerChanged) {
              _loadWorkerProfile();
            }
          },
        )
        .subscribe();
  }

  Future<void> _loadWorkerProfile() async {
    final workerId = _job.workerId;
    if (workerId == null) {
      if (_workerProfileChannel != null) {
        Supabase.instance.client.removeChannel(_workerProfileChannel!);
        _workerProfileChannel = null;
      }
      if (!mounted) return;
      setState(() {
        _workerProfile = null;
        _loadingWorkerProfile = false;
      });
      return;
    }

    setState(() {
      _loadingWorkerProfile = true;
    });

    try {
      final row = await Supabase.instance.client
          .from('profiles')
          .select(
            'full_name, worker_status, worker_work_details, worker_experience_years, worker_rating_avg, worker_rating_count',
          )
          .eq('id', workerId)
          .maybeSingle();

      if (!mounted) return;
      setState(() {
        _workerProfile = row == null
            ? null
            : _PublicWorkerProfile.fromJson(row);
        _loadingWorkerProfile = false;
      });
      _subscribeToWorkerProfile(workerId);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _workerProfile = null;
        _loadingWorkerProfile = false;
      });
    }
  }

  void _subscribeToWorkerProfile(String workerId) {
    final client = Supabase.instance.client;

    if (_workerProfileChannel != null) {
      client.removeChannel(_workerProfileChannel!);
      _workerProfileChannel = null;
    }

    _workerProfileChannel = client.channel('worker-profile-$workerId');
    _workerProfileChannel!
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'profiles',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: workerId,
          ),
          callback: (payload) {
            final next = _PublicWorkerProfile.fromJson(payload.newRecord);
            if (!mounted) return;
            setState(() {
              _workerProfile = next;
            });
          },
        )
        .subscribe();
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
      default:
        return Colors.grey;
    }
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Future<void> _markPaymentPaid(String method) async {
    if (_job.paymentStatus == 'paid') {
      return;
    }

    setState(() => _paying = true);

    try {
      final dueAmount = _job.payableAmount;
      if (dueAmount == null || dueAmount <= 0) {
        throw Exception('No payable amount found for this job.');
      }

      final updated = await Supabase.instance.client.rpc(
        'mark_job_paid',
        params: {
          'p_job_id': _job.id,
          'p_method': method,
        },
      );

      if (!mounted) {
        return;
      }

      setState(() => _job = Job.fromJson(jsonObjectFromRpc(updated)));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment recorded with ${method.toUpperCase()}.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment failed: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _paying = false);
      }
    }
  }

  Future<void> _cancelJob() async {
    if (_job.status != 'pending') {
      return;
    }

    setState(() => _cancelling = true);

    try {
      final updated = await Supabase.instance.client.rpc(
        'cancel_job',
        params: {'p_job_id': _job.id},
      );

      if (!mounted) return;

      setState(() => _job = Job.fromJson(jsonObjectFromRpc(updated)));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Job cancelled.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not cancel job: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _cancelling = false);
      }
    }
  }

  Future<void> _submitRating() async {
    if (_rating == 0) {
      setState(() => _ratingError = 'Select a rating first.');
      return;
    }

    setState(() {
      _ratingSubmitting = true;
      _ratingError = null;
    });

    try {
      await Supabase.instance.client.rpc(
        'rate_worker',
        params: {
          'p_job_id': _job.id,
          'p_rating': _rating,
          'p_comment': _ratingCommentController.text.trim().isEmpty
              ? null
              : _ratingCommentController.text.trim(),
        },
      );

      if (!mounted) return;
      setState(() {
        _ratingSubmitted = true;
        _rating = 0;
        _ratingCommentController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rating submitted.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _ratingError = 'Failed to submit rating: $error';
      });
    } finally {
      if (mounted) {
        setState(() => _ratingSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final serviceLabels = {
      'flat_tire': 'Flat Tire Fix',
      'jump_start': 'Jump Start',
      'fuel_delivery': 'Fuel Delivery',
      'towing': 'Towing',
      'moving_help': 'Moving Help',
      'handyman_help': 'Handyman Help',
      'plumbing_help': 'Plumbing Help',
      'electrical_help': 'Electrical Help',
      'cna_support': 'CNA Support',
      'senior_helper': 'Senior Helper',
      'cleaning_help': 'Cleaning Help',
      'delivery_help': 'Delivery Help',
      'pet_help': 'Pet Help',
      'tech_help': 'Tech Help',
      'others': 'Others',
    };

    return Scaffold(
      appBar: AppBar(
        title: Text(
          serviceLabels[_job.serviceType] ?? _job.serviceType,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Chip(
              label: Text(
                _job.status.replaceAll('_', ' '),
                style: const TextStyle(fontSize: 11, color: Colors.white),
              ),
              backgroundColor: _statusColor(_job.status),
              visualDensity: VisualDensity.compact,
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Job body header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_job.description),
                  const SizedBox(height: 8),
                  if (_job.locationName != null)
                    Text(
                      'Location: ${_job.locationName}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.grey),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    _timeAgo(_job.createdAt),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.grey),
                  ),
                  if (_job.estimatedPrice != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Est. \$${_job.estimatedPrice!.toStringAsFixed(2)}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                  if (_job.finalPrice != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Final \$${_job.finalPrice!.toStringAsFixed(2)}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            // Status details
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Job Status',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  if (_job.status == 'pending')
                    const Text('Waiting for helper to accept...', style: TextStyle(color: Colors.grey))
                  else if (_job.status == 'accepted') ...[
                    const Text('Helper accepted', style: TextStyle(color: Color(0xFF2E7D32))),
                    if (_job.acceptedAt != null)
                      Text(
                        'Accepted ${_timeAgo(_job.acceptedAt!)}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                  ] else if (_job.status == 'in_progress')
                    const Text('Helper is on the way', style: TextStyle(color: Color(0xFF0057FF)))
                  else if (_job.status == 'completed')
                    const Text('Job completed', style: TextStyle(color: Color(0xFF2E7D32)))
                  else if (_job.status == 'cancelled')
                    const Text('Job cancelled', style: TextStyle(color: Colors.grey))
                  else
                    Text(_job.status),
                  if (_job.status == 'pending') ...[
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _cancelling ? null : _cancelJob,
                      child: Text(_cancelling ? 'Cancelling...' : 'Cancel Job'),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Assigned Worker Profile',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  if (_job.workerId == null)
                    const Text(
                      'No worker assigned yet.',
                      style: TextStyle(color: Colors.grey),
                    )
                  else if (_loadingWorkerProfile)
                    const LinearProgressIndicator()
                  else if (_workerProfile == null)
                    const Text(
                      'Profile unavailable right now.',
                      style: TextStyle(color: Colors.grey),
                    )
                  else ...[
                    Text(
                      _workerProfile!.name,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Status: ${_workerProfile!.statusLabel}',
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    Text(
                      'Experience: ${_workerProfile!.experienceYears} years',
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    Text(
                      'Rating: ${_workerProfile!.ratingLabel}',
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    if (_workerProfile!.workDetails.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(_workerProfile!.workDetails),
                    ],
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Payment',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _job.paymentStatus == 'paid'
                        ? 'Paid${_job.paymentMethod != null ? ' via ${_job.paymentMethod}' : ''}'
                        : 'Not paid yet',
                    style: TextStyle(
                      color: _job.paymentStatus == 'paid'
                          ? const Color(0xFF2E7D32)
                          : const Color(0xFFE65100),
                    ),
                  ),
                  if (_job.payableAmount != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Amount due: \$${_job.payableAmount!.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ],
                  if (_job.status == 'cancelled') ...[
                    const SizedBox(height: 8),
                    const Text(
                      'No payment is due for cancelled jobs.',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ] else if (_job.status != 'completed') ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Payment buttons appear after the worker marks the job as completed.',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ],
                  if (_job.paymentReference != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Reference: ${_job.paymentReference}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                  if (_job.status == 'completed' &&
                      _job.paymentStatus != 'paid' &&
                      _job.payableAmount != null) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        FilledButton(
                          onPressed: _paying ? null : () => _markPaymentPaid('card'),
                          child: Text(_paying ? 'Processing...' : 'Pay by Card'),
                        ),
                        OutlinedButton(
                          onPressed: _paying ? null : () => _markPaymentPaid('upi'),
                          child: const Text('Mark Paid by UPI'),
                        ),
                      ],
                    ),
                  ],
                  if (_job.status == 'completed' && _job.workerId != null) ...[
                    const SizedBox(height: 24),
                    Text(
                      'Rate Helper',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (_ratingSubmitted)
                      const Text(
                        'Thanks for rating this helper.',
                        style: TextStyle(color: Color(0xFF2E7D32)),
                      )
                    else ...[
                      Wrap(
                        spacing: 4,
                        children: [1, 2, 3, 4, 5]
                            .map(
                              (value) => IconButton(
                                onPressed: _ratingSubmitting
                                    ? null
                                    : () => setState(() => _rating = value),
                                icon: Icon(
                                  _rating >= value ? Icons.star : Icons.star_border,
                                  color: const Color(0xFFFFB300),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _ratingCommentController,
                        enabled: !_ratingSubmitting,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Comment (optional)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      if (_ratingError != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _ratingError!,
                          style: const TextStyle(color: Color(0xFF8A1C0F)),
                        ),
                      ],
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _ratingSubmitting ? null : _submitRating,
                          child: Text(_ratingSubmitting ? 'Submitting...' : 'Submit Rating'),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicWorkerProfile {
  final String name;
  final String workerStatus;
  final String workDetails;
  final int experienceYears;
  final double ratingAverage;
  final int ratingCount;

  const _PublicWorkerProfile({
    required this.name,
    required this.workerStatus,
    required this.workDetails,
    required this.experienceYears,
    required this.ratingAverage,
    required this.ratingCount,
  });

  String get statusLabel {
    if (workerStatus == 'online') return 'online';
    if (workerStatus == 'on_job') return 'on job';
    return 'offline';
  }

  String get ratingLabel {
    if (ratingCount <= 0) {
      return 'new worker';
    }
    return '${ratingAverage.toStringAsFixed(1)} ($ratingCount reviews)';
  }

  factory _PublicWorkerProfile.fromJson(Map<String, dynamic> json) {
    final nameValue = (json['full_name'] as String?)?.trim() ?? '';
    return _PublicWorkerProfile(
      name: nameValue.isEmpty ? 'Worker' : nameValue,
      workerStatus: (json['worker_status'] as String?) ?? 'offline',
      workDetails: (json['worker_work_details'] as String?)?.trim() ?? '',
      experienceYears: (json['worker_experience_years'] as int?) ?? 0,
      ratingAverage: (json['worker_rating_avg'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['worker_rating_count'] as int?) ?? 0,
    );
  }
}
