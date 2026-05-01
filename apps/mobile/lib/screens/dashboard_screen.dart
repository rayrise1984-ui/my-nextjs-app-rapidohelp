import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/service_visuals.dart';
import '../models/support_models.dart';
import 'job_detail_screen.dart';

// Mock locations for MVP
const mockLocations = [
  {'name': 'Downtown (38.294, -122.286)', 'lat': 38.294, 'lng': -122.286},
  {'name': 'North (38.310, -122.286)', 'lat': 38.310, 'lng': -122.286},
  {'name': 'South (38.270, -122.286)', 'lat': 38.270, 'lng': -122.286},
];

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Job> _jobs = [];
  bool _loading = true;
  String? _error;
  RealtimeChannel? _channel;

  final _descriptionController = TextEditingController();
  final _estimateController = TextEditingController(text: '45');
  final _serviceAddressController = TextEditingController();
  final _scheduledForController = TextEditingController();
  bool _submitting = false;
  String _selectedService = 'flat_tire';
  Map<String, dynamic> _selectedLocation = mockLocations[0];
  String _bookingPaymentMethod = 'card';

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _estimateController.dispose();
    _serviceAddressController.dispose();
    _scheduledForController.dispose();
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    super.dispose();
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

  DateTime? _parseScheduledFor(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return null;
    final normalized = value.contains('T') ? value : value.replaceFirst(' ', 'T');
    return DateTime.tryParse(normalized);
  }

  Future<void> _initialize() async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return;

    try {
      final data = await client
          .from('jobs')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      if (!mounted) return;

      setState(() {
        _jobs = (data as List)
            .map((e) => Job.fromJson(e as Map<String, dynamic>))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }

    _channel = client.channel('user-jobs-$userId');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'jobs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final next = Job.fromJson(payload.newRecord);
            setState(() => _jobs = [next, ..._jobs]);
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'jobs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final updated = Job.fromJson(payload.newRecord);
            setState(() {
              _jobs = _jobs
                  .map((j) => j.id == updated.id ? updated : j)
                  .toList();
            });
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.delete,
          schema: 'public',
          table: 'jobs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            final deletedId = payload.oldRecord['id'] as String?;
            if (deletedId == null) return;
            setState(() {
              _jobs = _jobs.where((j) => j.id != deletedId).toList();
            });
          },
        )
        .subscribe();
  }

  Future<void> _postJob(BuildContext sheetContext) async {
    final description = _descriptionController.text.trim();
    final estimate = double.tryParse(_estimateController.text.trim());
    final serviceAddress = _serviceAddressController.text.trim();
    final scheduledFor = _parseScheduledFor(_scheduledForController.text);
    if (description.isEmpty) return;
    if (estimate == null || estimate <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid estimate price.')),
      );
      return;
    }
    if (serviceAddress.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the service address.')),
      );
      return;
    }
    if (scheduledFor == null || !scheduledFor.isAfter(DateTime.now())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Choose a future service time.')),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final inserted = await Supabase.instance.client.from('jobs').insert({
        'service_type': _selectedService,
        'description': description,
        'location_lat': _selectedLocation['lat'],
        'location_lng': _selectedLocation['lng'],
        'location_name': _selectedLocation['name'],
        'service_address': serviceAddress,
        'scheduled_for': scheduledFor.toUtc().toIso8601String(),
        'booking_payment_method': _bookingPaymentMethod,
        'estimated_price': estimate,
      }).select().single();
      if (mounted) {
        final next = Job.fromJson(inserted);
        setState(() {
          _jobs = [next, ..._jobs.where((j) => j.id != next.id)];
        });
      }
      _descriptionController.clear();
      _estimateController.text = '45';
      _serviceAddressController.clear();
      _scheduledForController.clear();
      _selectedService = 'flat_tire';
      _selectedLocation = mockLocations[0];
      _bookingPaymentMethod = 'card';
      if (mounted) Navigator.pop(sheetContext);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to post job: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showNewJobSheet() {
    _descriptionController.clear();
    _estimateController.text = '45';
    _serviceAddressController.clear();
    _scheduledForController.clear();
    _selectedService = 'flat_tire';
    _selectedLocation = mockLocations[0];
    _bookingPaymentMethod = 'card';
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            24,
            24,
            MediaQuery.viewInsetsOf(sheetContext).bottom + 24,
          ),
          child: StatefulBuilder(
            builder: (dialogContext, setDialogState) => Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Post a Job',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                Text(
                  'What do you need?',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    serviceVisualFor(_selectedService).imageUrl,
                    height: 130,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, _, __) {
                      final visual = serviceVisualFor(_selectedService);
                      return Container(
                        height: 130,
                        width: double.infinity,
                        color: const Color(0xFFE8EEF5),
                        alignment: Alignment.center,
                        child: Icon(
                          visual.fallbackIcon,
                          size: 40,
                          color: const Color(0xFF34506B),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _selectedService,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                  items: serviceTypeOrder
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(serviceVisualFor(type).label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setDialogState(() => _selectedService = value ?? 'flat_tire');
                  },
                ),
                const SizedBox(height: 12),
                Text(
                  'Service address',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _serviceAddressController,
                  decoration: const InputDecoration(
                    hintText: 'Apartment, street, building, city',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Schedule your service',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _scheduledForController,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    hintText: 'YYYY-MM-DD HH:MM',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Booking payment preference',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _bookingPaymentMethod,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'card', child: Text('Pay by card')),
                    DropdownMenuItem(value: 'upi', child: Text('Pay by UPI')),
                    DropdownMenuItem(value: 'cash', child: Text('Pay with cash')),
                  ],
                  onChanged: (value) {
                    setDialogState(() {
                      _bookingPaymentMethod = value ?? 'card';
                    });
                  },
                ),
                const SizedBox(height: 12),
                Text(
                  'Describe your situation',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descriptionController,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'E.g., front left tire is flat...',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Your estimate price',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _estimateController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    prefixText: '\$',
                    hintText: '45.00',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Location (test mode)',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<Map<String, dynamic>>(
                  value: _selectedLocation,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                  items: mockLocations
                      .map((loc) => DropdownMenuItem(
                            value: loc,
                            child: Text(loc['name'] as String),
                          ))
                      .toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() => _selectedLocation = value);
                    }
                  },
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _submitting ? null : () => _postJob(sheetContext),
                    child: Text(_submitting ? 'Posting…' : 'Post Job'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
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
      case 'cancelled':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Book Help'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: _signOut,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewJobSheet,
        icon: const Icon(Icons.add),
        label: const Text('Post Job'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _jobs.isEmpty
                  ? const Center(
                      child: Text('No jobs yet. Tap + to post one.'),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                      itemCount: _jobs.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final job = _jobs[index];
                        final visual = serviceVisualFor(job.serviceType);
                        return Card(
                          child: ListTile(
                            leading: ServiceAvatar(serviceType: job.serviceType),
                            title: Text(
                              visual.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              [
                                job.description,
                                if (job.serviceAddress != null)
                                  'Address: ${job.serviceAddress}',
                                if (job.scheduledFor != null)
                                  'When: ${_formatScheduledFor(job.scheduledFor)}',
                                if (job.bookingPaymentMethod != null)
                                  'Booking: ${_bookingPaymentLabel(job.bookingPaymentMethod)}',
                                if (job.estimatedPrice != null)
                                  'Estimate: \$${job.estimatedPrice!.toStringAsFixed(2)}',
                                if (job.finalPrice != null)
                                  'Final: \$${job.finalPrice!.toStringAsFixed(2)}',
                                'Payment: ${job.paymentStatus.replaceAll('_', ' ')}',
                              ].join('\n'),
                              maxLines: 6,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: Chip(
                              label: Text(
                                job.status.replaceAll('_', ' '),
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.white,
                                ),
                              ),
                              backgroundColor: _statusColor(job.status),
                              padding: EdgeInsets.zero,
                              visualDensity: VisualDensity.compact,
                            ),
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    JobDetailScreen(job: job),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
