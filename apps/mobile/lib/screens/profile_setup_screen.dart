import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
          .select('full_name, avatar_url')
          .eq('id', widget.userId)
          .maybeSingle();

      if (!mounted) return;
      setState(() {
        _fullNameController.text = (row?['full_name'] as String?) ?? '';
        _avatarUrlController.text = (row?['avatar_url'] as String?) ?? '';
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

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
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
