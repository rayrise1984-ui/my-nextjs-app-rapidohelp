import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/legal_terms.dart';
import 'core/supabase_config.dart';
import 'screens/dashboard_screen.dart';
import 'screens/profile_completion_gate.dart';
import 'screens/worker_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (SupabaseConfig.isConfigured) {
    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
    );
  }

  runApp(const RapidoHelpApp());
}

class RapidoHelpApp extends StatelessWidget {
  const RapidoHelpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RapidoHelp',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0057FF)),
        scaffoldBackgroundColor: const Color(0xFFF7F2EA),
        useMaterial3: true,
      ),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  Session? _session;
  late final Stream<AuthState> _authStream;

  @override
  void initState() {
    super.initState();
    _session = SupabaseConfig.isConfigured
        ? Supabase.instance.client.auth.currentSession
        : null;
    _authStream = SupabaseConfig.isConfigured
        ? Supabase.instance.client.auth.onAuthStateChange
        : const Stream<AuthState>.empty();
  }

  @override
  Widget build(BuildContext context) {
    if (!SupabaseConfig.isConfigured) {
      return const AuthScreen();
    }

    return StreamBuilder<AuthState>(
      stream: _authStream,
      initialData: AuthState(AuthChangeEvent.initialSession, _session),
      builder: (context, snapshot) {
        final session = snapshot.data?.session ?? _session;
        if (session != null) {
          return ProfileCompletionGate(
            session: session,
            child: TermsAcceptanceGate(
              session: session,
              child: SessionHome(session: session),
            ),
          );
        }
        return const AuthScreen();
      },
    );
  }
}

class TermsAcceptanceGate extends StatefulWidget {
  final Session session;
  final Widget child;

  const TermsAcceptanceGate({
    super.key,
    required this.session,
    required this.child,
  });

  @override
  State<TermsAcceptanceGate> createState() => _TermsAcceptanceGateState();
}

class _TermsAcceptanceGateState extends State<TermsAcceptanceGate> {
  bool _loading = true;
  bool _accepted = false;
  bool _checked = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAcceptance();
  }

  @override
  void didUpdateWidget(covariant TermsAcceptanceGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.user.id != widget.session.user.id) {
      _loadAcceptance();
    }
  }

  Future<void> _loadAcceptance() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final row = await Supabase.instance.client
          .from('profiles')
          .select('terms_accepted_at, terms_version')
          .eq('id', widget.session.user.id)
          .maybeSingle();

      if (!mounted) return;
      setState(() {
        _accepted = row?['terms_accepted_at'] != null &&
            row?['terms_version'] == termsVersion;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load Terms acceptance: $error';
        _accepted = false;
        _loading = false;
      });
    }
  }

  Future<void> _acceptTerms() async {
    if (!_checked) {
      setState(() => _error = 'Check the agreement box before continuing.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await Supabase.instance.client.rpc(
        'accept_terms',
        params: {
          'p_terms_version': termsVersion,
          'p_platform': 'mobile',
        },
      );

      if (!mounted) return;
      setState(() => _accepted = true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Could not save acceptance: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_accepted) {
      return widget.child;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Terms of Service')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Accept RapidoHelp Terms',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text('Effective $termsEffectiveDate. Version $termsVersion.'),
            const SizedBox(height: 16),
            Container(
              constraints: const BoxConstraints(maxHeight: 430),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFD8DEE8)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final section in legalTermSections) ...[
                      Text(
                        section.title,
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(section.body),
                      const SizedBox(height: 14),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _checked,
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _checked = value ?? false),
              title: const Text(
                'I have read and agree to the RapidoHelp Terms of Service, including the safety notice, independent worker terms, payment terms, liability limits, and arbitration/class action waiver.',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Color(0xFF8A1C0F))),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: !_checked || _submitting ? null : _acceptTerms,
                child: Text(_submitting ? 'Saving...' : 'I agree'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SessionHome extends StatefulWidget {
  final Session session;

  const SessionHome({super.key, required this.session});

  @override
  State<SessionHome> createState() => _SessionHomeState();
}

class _SessionHomeState extends State<SessionHome> {
  late Future<bool> _isWorkerFuture;

  @override
  void initState() {
    super.initState();
    _isWorkerFuture = _loadIsWorker();
  }

  @override
  void didUpdateWidget(covariant SessionHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.user.id != widget.session.user.id) {
      _isWorkerFuture = _loadIsWorker();
    }
  }

  Future<bool> _loadIsWorker() async {
    final response = await Supabase.instance.client
        .from('profiles')
        .select('is_worker')
        .eq('id', widget.session.user.id)
        .maybeSingle();

    return (response?['is_worker'] as bool?) ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _isWorkerFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.data == true) {
          return const WorkerScreen();
        }

        return const DashboardScreen();
      },
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _phoneCodeController = TextEditingController();

  bool _submitting = false;
  bool _createProfileMode = true;
  bool _helperAccount = false;
  bool _phoneCodeSent = false;
  bool _usePhoneLogin = false;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (SupabaseConfig.hasDevCustomerLogin) {
      _emailController.text = SupabaseConfig.devCustomerEmail;
      _passwordController.text = SupabaseConfig.devCustomerPassword;
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _phoneCodeController.dispose();
    super.dispose();
  }

  Future<void> _signInWithPassword() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty) {
      setState(() {
        _error = 'Enter an email address first.';
        _message = null;
      });
      return;
    }

    if (password.isEmpty) {
      setState(() {
        _error = 'Enter a password first.';
        _message = null;
      });
      return;
    }

    if (!SupabaseConfig.isConfigured) {
      setState(() {
        _error = 'Supabase is not configured for this build.';
        _message = null;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _message = 'Signed in successfully.';
      });
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Sign in failed. Try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _signInToDemoAccount({
    required String email,
    required String password,
    required String label,
  }) async {
    _emailController.text = email;
    _passwordController.text = password;

    setState(() {
      _message = 'Signing in as $label...';
      _error = null;
    });

    await _signInWithPassword();
  }

  Future<void> _signUpWithPassword() async {
    final fullName = _fullNameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (fullName.isEmpty) {
      setState(() {
        _error = 'Enter your full name first.';
        _message = null;
      });
      return;
    }

    if (email.isEmpty) {
      setState(() {
        _error = 'Enter an email address first.';
        _message = null;
      });
      return;
    }

    if (password.length < 6) {
      setState(() {
        _error = 'Password must be at least 6 characters.';
        _message = null;
      });
      return;
    }

    if (!SupabaseConfig.isConfigured) {
      setState(() {
        _error = 'Supabase is not configured for this build.';
        _message = null;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      await Supabase.instance.client.auth.signUp(
        email: email,
        password: password,
        data: {
          'full_name': fullName,
          'role': _helperAccount ? 'agent' : 'customer',
          'is_worker': _helperAccount,
        },
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _message = _helperAccount
            ? 'Helper profile created. Use Sign in to continue.'
            : 'Profile created. Use Sign in to continue.';
      });
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to create account right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _sendPhoneCode() async {
    final phone = _phoneController.text.trim();

    if (phone.isEmpty) {
      setState(() {
        _error = 'Enter a phone number first.';
        _message = null;
      });
      return;
    }

    if (!SupabaseConfig.isConfigured) {
      setState(() {
        _error = 'Supabase is not configured for this build.';
        _message = null;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      await Supabase.instance.client.auth.signInWithOtp(phone: phone);

      if (!mounted) {
        return;
      }

      setState(() {
        _phoneCodeSent = true;
        _message = 'SMS code sent. Enter it below to sign in.';
      });
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to send SMS code right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _verifyPhoneCode() async {
    final phone = _phoneController.text.trim();
    final code = _phoneCodeController.text.trim();

    if (phone.isEmpty || code.isEmpty) {
      setState(() {
        _error = 'Enter your phone number and SMS code.';
        _message = null;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      await Supabase.instance.client.auth.verifyOTP(
        phone: phone,
        token: code,
        type: OtpType.sms,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _message = 'Signed in successfully.';
      });
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Phone sign-in failed. Try again.';
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
    final currentUser = SupabaseConfig.isConfigured
        ? Supabase.instance.client.auth.currentUser
        : null;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RapidoHelp Mobile',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 12),
              Text(
                'Create your profile first, then sign in to continue.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      SupabaseConfig.isConfigured
                          ? 'Supabase mobile client is ready.'
                          : 'Run with --dart-define=SUPABASE_URL=... and --dart-define=SUPABASE_ANON_KEY=...',
                    ),
                    const SizedBox(height: 16),
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment<bool>(
                          value: true,
                          label: Text('Create profile'),
                          icon: Icon(Icons.person_add_outlined),
                        ),
                        ButtonSegment<bool>(
                          value: false,
                          label: Text('Sign in'),
                          icon: Icon(Icons.login_outlined),
                        ),
                      ],
                      selected: {_createProfileMode},
                      onSelectionChanged: _submitting
                          ? null
                          : (selection) {
                              setState(() {
                                _createProfileMode = selection.first;
                                _usePhoneLogin = false;
                                _phoneCodeSent = false;
                                _error = null;
                                _message = null;
                              });
                            },
                    ),
                    const SizedBox(height: 16),
                    if (_createProfileMode) ...[
                      Text(
                        'Create your profile before you sign in.',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _fullNameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Full name',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment<bool>(
                            value: false,
                            label: Text('Customer'),
                            icon: Icon(Icons.person_outline),
                          ),
                          ButtonSegment<bool>(
                            value: true,
                            label: Text('Helper'),
                            icon: Icon(Icons.work_outline),
                          ),
                        ],
                        selected: {_helperAccount},
                        onSelectionChanged: _submitting
                            ? null
                            : (selection) {
                                setState(() {
                                  _helperAccount = selection.first;
                                  _error = null;
                                  _message = null;
                                });
                              },
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _passwordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _submitting ? null : _signUpWithPassword,
                          child: Text(
                            _submitting ? 'Please wait...' : 'Create profile',
                          ),
                        ),
                      ),
                    ] else ...[
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment<bool>(
                            value: false,
                            label: Text('Email'),
                            icon: Icon(Icons.email_outlined),
                          ),
                          ButtonSegment<bool>(
                            value: true,
                            label: Text('Phone'),
                            icon: Icon(Icons.phone_outlined),
                          ),
                        ],
                        selected: {_usePhoneLogin},
                        onSelectionChanged: _submitting
                            ? null
                            : (selection) {
                                setState(() {
                                  _usePhoneLogin = selection.first;
                                  _error = null;
                                  _message = null;
                                });
                              },
                      ),
                      const SizedBox(height: 16),
                      if (!_usePhoneLogin &&
                          (SupabaseConfig.hasDevCustomerLogin ||
                              SupabaseConfig.hasWorkerLogin)) ...[
                        Text(
                          'Quick start',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 12),
                        if (SupabaseConfig.hasDevCustomerLogin)
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.tonal(
                              onPressed: _submitting
                                  ? null
                                  : () => _signInToDemoAccount(
                                        email: SupabaseConfig.devCustomerEmail,
                                        password:
                                            SupabaseConfig.devCustomerPassword,
                                        label: 'demo customer',
                                      ),
                              child: const Text('Continue as Demo Customer'),
                            ),
                          ),
                        if (SupabaseConfig.hasDevCustomerLogin &&
                            SupabaseConfig.hasWorkerLogin)
                          const SizedBox(height: 12),
                        if (SupabaseConfig.hasWorkerLogin)
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.tonal(
                              onPressed: _submitting
                                  ? null
                                  : () => _signInToDemoAccount(
                                        email: SupabaseConfig.workerLoginEmail,
                                        password:
                                            SupabaseConfig.workerLoginPassword,
                                        label: SupabaseConfig.workerLoginName,
                                      ),
                              child: Text(SupabaseConfig.workerLoginButtonText),
                            ),
                          ),
                        const SizedBox(height: 16),
                      ],
                      if (!_usePhoneLogin) ...[
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Email address',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Password',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed:
                                _submitting ? null : _signInWithPassword,
                            child: Text(
                              _submitting ? 'Please wait...' : 'Sign in',
                            ),
                          ),
                        ),
                      ] else ...[
                        TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Phone number',
                            hintText: '+15551234567',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        if (_phoneCodeSent) ...[
                          const SizedBox(height: 16),
                          TextField(
                            controller: _phoneCodeController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'SMS code',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _submitting
                                ? null
                                : _phoneCodeSent
                                    ? _verifyPhoneCode
                                    : _sendPhoneCode,
                            child: Text(
                              _submitting
                                  ? 'Please wait...'
                                  : _phoneCodeSent
                                      ? 'Verify code'
                                      : 'Send SMS code',
                            ),
                          ),
                        ),
                      ],
                    ],
                    const SizedBox(height: 12),
                    Text(
                      _createProfileMode
                          ? 'New customer and helper accounts start here.'
                          : _usePhoneLogin
                              ? 'Phone login requires SMS auth to be enabled in Supabase.'
                              : (SupabaseConfig.hasDevCustomerLogin ||
                                      SupabaseConfig.hasWorkerLogin)
                                  ? 'Quick start buttons fill valid accounts instantly. Manual sign-in is still available below.'
                                  : 'Dev mode: create a profile once, then sign in with the same credentials.',
                    ),
                    if (_message != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        _message!,
                        style: const TextStyle(color: Color(0xFF1B5E20)),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        _error!,
                        style: const TextStyle(color: Color(0xFF8A1C0F)),
                      ),
                    ],
                    if (currentUser != null) ...[
                      const SizedBox(height: 16),
                      Text('Signed in as ${currentUser.email ?? currentUser.id}'),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
