import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rapidohelp_mobile/core/service_visuals.dart';

void main() {
  test('serviceTypeOrder covers the marketplace catalog', () {
    expect(serviceTypeOrder, containsAll([
      'flat_tire',
      'jump_start',
      'fuel_delivery',
      'towing',
      'moving_help',
      'handyman_help',
      'plumbing_help',
      'electrical_help',
      'cna_support',
      'senior_helper',
      'cleaning_help',
      'delivery_help',
      'pet_help',
      'tech_help',
      'others',
    ]));
  });

  test('serviceVisualFor returns labels and unknown fallback', () {
    expect(serviceVisualFor('flat_tire').label, 'Flat Tire Fix');
    expect(serviceVisualFor('tech_help').fallbackIcon, Icons.computer);
    expect(serviceVisualFor('unknown').label, 'Others');
  });

  testWidgets('ServiceAvatar renders a fixed-size image container', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ServiceAvatar(serviceType: 'flat_tire', size: 32),
        ),
      ),
    );

    final clip = tester.widget<ClipRRect>(find.byType(ClipRRect));
    expect(clip.borderRadius, BorderRadius.circular(16));
    expect(find.byType(Image), findsOneWidget);
  });
}
