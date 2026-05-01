import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'profile_setup_screen.dart';

class ProfileCompletionGate extends StatefulWidget {
  final Session session;
  final Widget child;

  const ProfileCompletionGate({
    super.key,
    required this.session,
    required this.child,
  });

  @override
  State<ProfileCompletionGate> createState() => _ProfileCompletionGateState();
}

class _ProfileCompletionGateState extends State<ProfileCompletionGate> {
  bool _loading = true;
  bool _completed = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void didUpdateWidget(covariant ProfileCompletionGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.user.id != widget.session.user.id) {
      _loadProfile();
    }
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final row = await Supabase.instance.client
          .from('profiles')
          .select('full_name')
          .eq('id', widget.session.user.id)
          .maybeSingle();

      if (!mounted) return;
      setState(() {
        _completed = ((row?['full_name'] as String?) ?? '').trim().isNotEmpty;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load your profile: $error';
        _completed = false;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        body: Center(child: Text(_error!)),
      );
    }

    if (_completed) {
      return widget.child;
    }

    return ProfileSetupScreen(
      userId: widget.session.user.id,
      onCompleted: () {
        if (!mounted) return;
        setState(() => _completed = true);
      },
    );
  }
}
