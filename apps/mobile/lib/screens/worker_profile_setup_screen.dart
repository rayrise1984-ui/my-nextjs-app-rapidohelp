import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/service_visuals.dart';

class WorkerProfileSetupScreen extends StatefulWidget {
  final String userId;
  const WorkerProfileSetupScreen({super.key, required this.userId});

  @override
  State<WorkerProfileSetupScreen> createState() => _WorkerProfileSetupScreenState();
}

class _WorkerProfileSetupScreenState extends State<WorkerProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _status;
  String? _workDetails;
  int? _experienceYears;
  List<String> _serviceTypes = [];
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final row = await Supabase.instance.client
        .from('profiles')
        .select('worker_status, worker_work_details, worker_experience_years, service_types')
        .eq('id', widget.userId)
        .maybeSingle();
    if (!mounted) return;
    if (row != null) {
      final rowStatus = row['worker_status'] as String?;
      setState(() {
        _status = rowStatus == 'on_job' ? 'offline' : rowStatus;
        _workDetails = row['worker_work_details'] as String?;
        _experienceYears = row['worker_experience_years'] as int?;
        _serviceTypes = List<String>.from((row['service_types'] as List?) ?? const []);
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_serviceTypes.isEmpty) {
      setState(() {
        _error = 'Select at least one service you can handle.';
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await Supabase.instance.client
          .from('profiles')
          .update({
            'worker_status': 'offline',
            'worker_work_details': _workDetails,
            'worker_experience_years': _experienceYears,
            'service_types': _serviceTypes,
            'worker_profile_completed': true,
          })
          .eq('id', widget.userId);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to save: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complete Worker Profile')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text(
                'Before you can accept jobs, please complete your worker profile.',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(
                  labelText: 'Status',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'online', child: Text('Online')),
                  DropdownMenuItem(value: 'offline', child: Text('Offline')),
                ],
                validator: (v) => v == null || v.isEmpty ? 'Select your status' : null,
                onChanged: (v) => setState(() => _status = v),
              ),
              const SizedBox(height: 8),
              const Text(
                'New worker profiles stay offline until staff approval is complete.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              Text(
                'Services Offered',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              ...serviceTypeOrder.map((type) {
                final selected = _serviceTypes.contains(type);
                return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(serviceVisualFor(type).label),
                  value: selected,
                  onChanged: _submitting
                      ? null
                      : (value) {
                          setState(() {
                            if (value == true) {
                              _serviceTypes = [..._serviceTypes, type];
                            } else {
                              _serviceTypes = _serviceTypes.where((entry) => entry != type).toList();
                            }
                          });
                        },
                );
              }),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _workDetails,
                decoration: const InputDecoration(
                  labelText: 'Work Details',
                  border: OutlineInputBorder(),
                  hintText: 'Describe your skills, services, or specialties',
                ),
                minLines: 2,
                maxLines: 4,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter work details' : null,
                onChanged: (v) => _workDetails = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _experienceYears?.toString(),
                decoration: const InputDecoration(
                  labelText: 'Experience (years)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 0) return 'Enter a valid number of years';
                  return null;
                },
                onChanged: (v) => _experienceYears = int.tryParse(v),
              ),
              const SizedBox(height: 24),
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 12),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? 'Saving...' : 'Save Profile'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
