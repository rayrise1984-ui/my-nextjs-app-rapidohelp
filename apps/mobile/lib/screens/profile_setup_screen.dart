import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const helperBackgroundCheckConsentVersion = 'helper_background_check_v1';

class ProfileSetupScreen extends StatefulWidget {
  final String userId;
  final VoidCallback? onCompleted;

  const ProfileSetupScreen({
    super.key,
    required this.userId,
    this.onCompleted,
  });

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _avatarUrlController = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  bool _isWorker = false;
  bool _needsWorkerConsent = false;
  bool _workerBackgroundCheckConsent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _avatarUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final row = await Supabase.instance.client
          .from('profiles')
          .select(
            'full_name, avatar_url, is_worker, worker_background_check_consent_at, worker_background_check_consent_platform, worker_background_check_consent_version',
          )
          .eq('id', widget.userId)
          .maybeSingle();

      if (!mounted) return;
      final isWorker = (row?['is_worker'] as bool?) ?? false;
      final consentSatisfied = !isWorker ||
          ((row?['worker_background_check_consent_at'] as String?) != null &&
              (row?['worker_background_check_consent_platform'] as String?) != null &&
              (row?['worker_background_check_consent_version'] as String?) ==
                  helperBackgroundCheckConsentVersion);
      setState(() {
        _fullNameController.text = (row?['full_name'] as String?) ?? '';
        _avatarUrlController.text = (row?['avatar_url'] as String?) ?? '';
        _isWorker = isWorker;
        _needsWorkerConsent = isWorker && !consentSatisfied;
        _workerBackgroundCheckConsent = consentSatisfied;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load your profile: $error';
        _loading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    if (_needsWorkerConsent && !_workerBackgroundCheckConsent) {
      setState(() {
        _error = 'Helpers must consent to a background check before continuing.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final client = Supabase.instance.client;

      if (_needsWorkerConsent) {
        final consentResponse = await client.rpc(
          'accept_worker_background_check_consent',
          params: {
            'p_platform': 'mobile',
            'p_consent_version': helperBackgroundCheckConsentVersion,
          },
        );

        if (consentResponse == null) {
          throw Exception('Could not save background check consent.');
        }
      }

      final updatedProfile = await Supabase.instance.client
          .from('profiles')
          .update({
            'full_name': _fullNameController.text.trim(),
            'avatar_url': _avatarUrlController.text.trim().isEmpty
                ? null
                : _avatarUrlController.text.trim(),
          })
          .eq('id', widget.userId)
          .select('id')
          .maybeSingle();

      if (!mounted) return;

      if (updatedProfile == null) {
        setState(() {
          _error = 'Your profile could not be saved. Please try again.';
        });
        return;
      }

      if (widget.onCompleted != null) {
        widget.onCompleted!();
        return;
      }

      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to save your profile: $error';
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
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Create Profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Complete your profile before using RapidoHelp.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'We need your full name before you can continue into the app.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _fullNameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Full name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) =>
                        value == null || value.trim().isEmpty
                            ? 'Enter your full name'
                            : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _avatarUrlController,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Avatar URL',
                      border: OutlineInputBorder(),
                      hintText: 'Optional profile image link',
                    ),
                  ),
                  if (_isWorker && _needsWorkerConsent) ...[
                    const SizedBox(height: 16),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: _workerBackgroundCheckConsent,
                      onChanged: _submitting
                          ? null
                          : (value) {
                              setState(() => _workerBackgroundCheckConsent = value ?? false);
                            },
                      title: const Text(
                        'I consent to a background check so RapidoHelp can review my helper profile for approval.',
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _saveProfile,
                      child: Text(_submitting ? 'Saving...' : 'Continue'),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFF8A1C0F)),
                    ),
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
