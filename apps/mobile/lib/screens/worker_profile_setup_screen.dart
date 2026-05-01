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
  String? _legalFullName;
  String? _ssnLast4;
  String? _driverLicenseNumber;
  String? _driverLicenseState;
  String? _legalAddressLine1;
  String? _legalAddressLine2;
  String? _legalCity;
  String? _legalState;
  String? _legalPostalCode;
  String? _payoutAccountHolderName;
  String? _payoutBankName;
  String? _payoutAccountType;
  String? _payoutAccountLast4;
  String? _payoutRoutingLast4;
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
        .select('full_name, worker_status, worker_work_details, worker_experience_years, service_types')
        .eq('id', widget.userId)
        .maybeSingle();
    if (!mounted) return;
    final profileFullName = row?['full_name'] as String?;
    if (row != null) {
      final rowStatus = row['worker_status'] as String?;
      setState(() {
        _status = rowStatus == 'on_job' ? 'offline' : rowStatus;
        _workDetails = row['worker_work_details'] as String?;
        _experienceYears = row['worker_experience_years'] as int?;
        _serviceTypes = List<String>.from((row['service_types'] as List?) ?? const []);
        _payoutAccountHolderName = profileFullName;
      });
    }

    final backgroundRow = await Supabase.instance.client
        .from('worker_background_checks')
        .select(
          'legal_full_name, ssn_last4, driver_license_number, driver_license_state, legal_address_line1, legal_address_line2, legal_city, legal_state, legal_postal_code, payout_account_holder_name, payout_bank_name, payout_account_type, payout_account_last4, payout_routing_last4',
        )
        .eq('worker_id', widget.userId)
        .maybeSingle();

    if (!mounted || backgroundRow == null) return;
    setState(() {
      _legalFullName = backgroundRow['legal_full_name'] as String?;
      _ssnLast4 = backgroundRow['ssn_last4'] as String?;
      _driverLicenseNumber = backgroundRow['driver_license_number'] as String?;
      _driverLicenseState = backgroundRow['driver_license_state'] as String?;
      _legalAddressLine1 = backgroundRow['legal_address_line1'] as String?;
      _legalAddressLine2 = backgroundRow['legal_address_line2'] as String?;
      _legalCity = backgroundRow['legal_city'] as String?;
      _legalState = backgroundRow['legal_state'] as String?;
      _legalPostalCode = backgroundRow['legal_postal_code'] as String?;
      _payoutAccountHolderName =
          (backgroundRow['payout_account_holder_name'] as String?) ?? _payoutAccountHolderName ?? profileFullName;
      _payoutBankName = backgroundRow['payout_bank_name'] as String?;
      final payoutAccountType = (backgroundRow['payout_account_type'] as String?)?.trim().toLowerCase();
      _payoutAccountType = payoutAccountType == null || payoutAccountType.isEmpty ? null : payoutAccountType;
      _payoutAccountLast4 = backgroundRow['payout_account_last4'] as String?;
      _payoutRoutingLast4 = backgroundRow['payout_routing_last4'] as String?;
    });
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
      await Supabase.instance.client.rpc(
        'submit_worker_profile',
        params: {
          'p_worker_status': 'offline',
          'p_worker_work_details': _workDetails?.trim(),
          'p_worker_experience_years': _experienceYears,
          'p_service_types': _serviceTypes,
          'p_legal_full_name': _legalFullName?.trim(),
          'p_ssn_last4': (_ssnLast4 ?? '').replaceAll(RegExp(r'\D'), ''),
          'p_driver_license_number': _driverLicenseNumber?.trim(),
          'p_driver_license_state': _driverLicenseState?.trim().toUpperCase(),
          'p_legal_address_line1': _legalAddressLine1?.trim(),
          'p_legal_address_line2': _legalAddressLine2?.trim(),
          'p_legal_city': _legalCity?.trim(),
          'p_legal_state': _legalState?.trim().toUpperCase(),
          'p_legal_postal_code': _legalPostalCode?.trim().toUpperCase(),
          'p_payout_account_holder_name': _payoutAccountHolderName?.trim(),
          'p_payout_bank_name': _payoutBankName?.trim(),
          'p_payout_account_type': _payoutAccountType?.trim().toLowerCase(),
          'p_payout_account_last4': (_payoutAccountLast4 ?? '').replaceAll(RegExp(r'\D'), ''),
          'p_payout_routing_last4': (_payoutRoutingLast4 ?? '').replaceAll(RegExp(r'\D'), ''),
        },
      );
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
              Text(
                'Background Check Details',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                'Use your legal information. RapidoHelp stores SSN last 4 here; full SSN collection should stay with an approved background-check provider.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalFullName,
                decoration: const InputDecoration(
                  labelText: 'Legal full name',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter your legal full name' : null,
                onChanged: (v) => _legalFullName = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _ssnLast4,
                decoration: const InputDecoration(
                  labelText: 'SSN last 4',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                maxLength: 4,
                validator: (v) {
                  final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  if (!RegExp(r'^\d{4}$').hasMatch(digits)) return 'Enter the last 4 digits of your SSN';
                  return null;
                },
                onChanged: (v) => _ssnLast4 = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _driverLicenseNumber,
                decoration: const InputDecoration(
                  labelText: 'Driver license number',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.characters,
                validator: (v) => v == null || v.trim().length < 3 ? 'Enter your driver license number' : null,
                onChanged: (v) => _driverLicenseNumber = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _driverLicenseState,
                decoration: const InputDecoration(
                  labelText: 'Driver license state',
                  border: OutlineInputBorder(),
                  hintText: 'CA',
                ),
                maxLength: 2,
                textCapitalization: TextCapitalization.characters,
                validator: (v) {
                  if (!RegExp(r'^[A-Za-z]{2}$').hasMatch((v ?? '').trim())) return 'Enter a two-letter state';
                  return null;
                },
                onChanged: (v) => _driverLicenseState = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalAddressLine1,
                decoration: const InputDecoration(
                  labelText: 'Legal address',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter your legal address' : null,
                onChanged: (v) => _legalAddressLine1 = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalAddressLine2,
                decoration: const InputDecoration(
                  labelText: 'Apt, suite, unit (optional)',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                onChanged: (v) => _legalAddressLine2 = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalCity,
                decoration: const InputDecoration(
                  labelText: 'City',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter your city' : null,
                onChanged: (v) => _legalCity = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalState,
                decoration: const InputDecoration(
                  labelText: 'State',
                  border: OutlineInputBorder(),
                  hintText: 'CA',
                ),
                maxLength: 2,
                textCapitalization: TextCapitalization.characters,
                validator: (v) {
                  if (!RegExp(r'^[A-Za-z]{2}$').hasMatch((v ?? '').trim())) return 'Enter a two-letter state';
                  return null;
                },
                onChanged: (v) => _legalState = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _legalPostalCode,
                decoration: const InputDecoration(
                  labelText: 'ZIP / postal code',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.characters,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter your ZIP or postal code' : null,
                onChanged: (v) => _legalPostalCode = v,
              ),
              const SizedBox(height: 24),
              Text(
                'Payout Account Information',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                'Use the bank account where your worker payouts should go. We keep this information on file for payout setup and review.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _payoutAccountHolderName,
                decoration: const InputDecoration(
                  labelText: 'Account holder name',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter the account holder name' : null,
                onChanged: (v) => _payoutAccountHolderName = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _payoutBankName,
                decoration: const InputDecoration(
                  labelText: 'Bank name',
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
                validator: (v) => v == null || v.trim().isEmpty ? 'Enter the bank name' : null,
                onChanged: (v) => _payoutBankName = v,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _payoutAccountType,
                decoration: const InputDecoration(
                  labelText: 'Account type',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'checking', child: Text('Checking')),
                  DropdownMenuItem(value: 'savings', child: Text('Savings')),
                ],
                validator: (v) => v == null || v.isEmpty ? 'Select an account type' : null,
                onChanged: (v) => setState(() => _payoutAccountType = v),
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _payoutAccountLast4,
                decoration: const InputDecoration(
                  labelText: 'Account last 4',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                maxLength: 4,
                validator: (v) {
                  final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  if (!RegExp(r'^\d{4}$').hasMatch(digits)) return 'Enter the last 4 digits of your account number';
                  return null;
                },
                onChanged: (v) => _payoutAccountLast4 = v,
              ),
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _payoutRoutingLast4,
                decoration: const InputDecoration(
                  labelText: 'Routing last 4',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
                maxLength: 4,
                validator: (v) {
                  final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  if (!RegExp(r'^\d{4}$').hasMatch(digits)) return 'Enter the last 4 digits of your routing number';
                  return null;
                },
                onChanged: (v) => _payoutRoutingLast4 = v,
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
