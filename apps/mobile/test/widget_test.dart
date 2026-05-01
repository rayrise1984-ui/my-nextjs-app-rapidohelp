import 'package:flutter_test/flutter_test.dart';
import 'package:rapidohelp_mobile/main.dart';

void main() {
  testWidgets('App renders auth shell when Supabase is not configured', (tester) async {
    await tester.pumpWidget(const RapidoHelpApp());

    expect(find.text('RapidoHelp Mobile'), findsOneWidget);
    expect(
      find.text('Run with --dart-define=SUPABASE_URL=... and --dart-define=SUPABASE_ANON_KEY=...'),
      findsOneWidget,
    );
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Phone'), findsOneWidget);
  });

  testWidgets('Auth shell switches between email and phone modes', (tester) async {
    await tester.pumpWidget(const RapidoHelpApp());

    expect(find.text('Email address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Send email code'), findsOneWidget);

    await tester.tap(find.text('Phone'));
    await tester.pumpAndSettle();

    expect(find.text('Phone number'), findsOneWidget);
    expect(find.text('Send SMS code'), findsOneWidget);
  });

  testWidgets('Helper profile signup shows background check consent', (tester) async {
    await tester.pumpWidget(const RapidoHelpApp());

    await tester.tap(find.text('Helper'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'I consent to a background check so RapidoHelp can review my helper profile for approval.',
      ),
      findsOneWidget,
    );
  });
}
