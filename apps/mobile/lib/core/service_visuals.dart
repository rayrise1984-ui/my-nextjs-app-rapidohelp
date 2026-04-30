import 'package:flutter/material.dart';

class ServiceVisual {
  final String label;
  final String imageUrl;
  final IconData fallbackIcon;

  const ServiceVisual({
    required this.label,
    required this.imageUrl,
    required this.fallbackIcon,
  });
}

const List<String> serviceTypeOrder = [
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
];

const Map<String, ServiceVisual> _serviceVisuals = {
  'flat_tire': ServiceVisual(
    label: 'Flat Tire Fix',
    imageUrl:
        'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.tire_repair,
  ),
  'jump_start': ServiceVisual(
    label: 'Jump Start',
    imageUrl:
        'https://images.unsplash.com/photo-1617469767053-1652f2f0f1ac?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.electrical_services,
  ),
  'fuel_delivery': ServiceVisual(
    label: 'Fuel Delivery',
    imageUrl:
        'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.local_gas_station,
  ),
  'towing': ServiceVisual(
    label: 'Towing',
    imageUrl:
        'https://images.unsplash.com/photo-1565043666747-69f6646db940?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.car_crash,
  ),
  'moving_help': ServiceVisual(
    label: 'Moving Help',
    imageUrl:
        'https://images.unsplash.com/photo-1595079676601-f1adf5c5c63f?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.inventory_2,
  ),
  'handyman_help': ServiceVisual(
    label: 'Handyman Help',
    imageUrl:
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.handyman,
  ),
  'plumbing_help': ServiceVisual(
    label: 'Plumbing Help',
    imageUrl:
        'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.plumbing,
  ),
  'electrical_help': ServiceVisual(
    label: 'Electrical Help',
    imageUrl:
        'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.electrical_services,
  ),
  'cna_support': ServiceVisual(
    label: 'CNA Support',
    imageUrl:
        'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.health_and_safety,
  ),
  'senior_helper': ServiceVisual(
    label: 'Senior Helper',
    imageUrl:
        'https://images.unsplash.com/photo-1581579185169-84d8e2b441b2?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.elderly,
  ),
  'cleaning_help': ServiceVisual(
    label: 'Cleaning Help',
    imageUrl:
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.cleaning_services,
  ),
  'delivery_help': ServiceVisual(
    label: 'Delivery Help',
    imageUrl:
        'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.local_shipping,
  ),
  'pet_help': ServiceVisual(
    label: 'Pet Help',
    imageUrl:
        'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.pets,
  ),
  'tech_help': ServiceVisual(
    label: 'Tech Help',
    imageUrl:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.computer,
  ),
  'others': ServiceVisual(
    label: 'Others',
    imageUrl:
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    fallbackIcon: Icons.miscellaneous_services,
  ),
};

ServiceVisual serviceVisualFor(String serviceType) {
  return _serviceVisuals[serviceType] ?? _serviceVisuals['others']!;
}

class ServiceAvatar extends StatelessWidget {
  final String serviceType;
  final double size;

  const ServiceAvatar({
    super.key,
    required this.serviceType,
    this.size = 48,
  });

  @override
  Widget build(BuildContext context) {
    final visual = serviceVisualFor(serviceType);
    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 2),
      child: Image.network(
        visual.imageUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, _, __) {
          return Container(
            width: size,
            height: size,
            color: const Color(0xFFE8EEF5),
            alignment: Alignment.center,
            child: Icon(
              visual.fallbackIcon,
              size: size * 0.55,
              color: const Color(0xFF34506B),
            ),
          );
        },
      ),
    );
  }
}
