import type { ServiceType } from "./marketplace.ts";
import { bookableServiceTypes } from "./marketplace.ts";

export type ServiceGroupId = "roadside" | "home_services" | "care_support" | "moving_errands";

export interface ServiceGroup {
  id: ServiceGroupId;
  label: string;
  description: string;
  serviceTypes: ServiceType[];
}

export interface ServiceCatalogEntry {
  serviceType: ServiceType;
  groupId: ServiceGroupId;
  groupLabel: string;
  title: string;
  subtitle: string;
  summary: string;
  image: string;
  priceFrom: number;
  typicalDuration: string;
  averageRating: number;
  reviewCount: string;
  highlights: string[];
  includes: string[];
  addOns: string[];
  searchTerms: string[];
}

export const serviceGroups: ServiceGroup[] = [
  {
    id: "roadside",
    label: "Roadside help",
    description: "Fast support when a vehicle needs attention right away.",
    serviceTypes: ["flat_tire", "jump_start", "fuel_delivery", "towing"],
  },
  {
    id: "home_services",
    label: "Home services",
    description: "Repairs, maintenance, cleanup, and setup around the house.",
    serviceTypes: ["handyman_help", "plumbing_help", "electrical_help", "cleaning_help", "tech_help"],
  },
  {
    id: "care_support",
    label: "Care and support",
    description: "Hands-on help for family routines, pets, and day-to-day support.",
    serviceTypes: ["cna_support", "senior_helper", "pet_help"],
  },
  {
    id: "moving_errands",
    label: "Moving and errands",
    description: "Packing, lifting, errands, and delivery support for busy days.",
    serviceTypes: ["moving_help", "delivery_help"],
  },
];

export const serviceCatalog = {
  flat_tire: {
    serviceType: "flat_tire",
    groupId: "roadside",
    groupLabel: "Roadside help",
    title: "Flat Tire Fix",
    subtitle: "Roadside tire repair and spare change",
    summary: "Book a verified helper to come to your vehicle, inspect the tire, and get you moving again with a repair, inflation, or spare swap.",
    image: "/images/roadside-work-hero.png",
    priceFrom: 39,
    typicalDuration: "20-40 min",
    averageRating: 4.9,
    reviewCount: "12k+",
    highlights: ["On-site arrival", "Pressure check", "Spare tire change"],
    includes: ["Puncture assessment", "Inflation top-up", "Safety inspection", "Basic wheel-lug check"],
    addOns: ["Emergency tow", "Wheel balancing", "Emergency return visit"],
    searchTerms: ["tire", "puncture", "wheel", "roadside", "spare"],
  },
  jump_start: {
    serviceType: "jump_start",
    groupId: "roadside",
    groupLabel: "Roadside help",
    title: "Jump Start",
    subtitle: "Dead battery help at your location",
    summary: "Get a safe battery boost, quick charging check, and roadside support to help your car restart without a shop visit.",
    image: "/images/jump-start-service.png",
    priceFrom: 29,
    typicalDuration: "15-25 min",
    averageRating: 4.8,
    reviewCount: "9k+",
    highlights: ["Battery boost", "Quick diagnostics", "Fast arrival"],
    includes: ["Jump start", "Battery condition check", "Alternator warning review"],
    addOns: ["Battery replacement", "Tow if needed", "Night-time priority"],
    searchTerms: ["battery", "jump", "start", "car", "roadside"],
  },
  fuel_delivery: {
    serviceType: "fuel_delivery",
    groupId: "roadside",
    groupLabel: "Roadside help",
    title: "Fuel Delivery",
    subtitle: "Emergency fuel brought to your car",
    summary: "Order fuel delivery when your tank is empty and you need enough gas or diesel to reach the next safe stop.",
    image: "/images/fuel-delivery-service.png",
    priceFrom: 35,
    typicalDuration: "20-30 min",
    averageRating: 4.8,
    reviewCount: "6k+",
    highlights: ["Fuel brought to you", "Fast roadside response", "Safe fuel handling"],
    includes: ["Fuel drop-off", "Tank safety check", "Short idle check"],
    addOns: ["Extra fuel", "Night support", "Tow on request"],
    searchTerms: ["fuel", "gas", "diesel", "petrol", "empty tank"],
  },
  towing: {
    serviceType: "towing",
    groupId: "roadside",
    groupLabel: "Roadside help",
    title: "Towing & Recovery",
    subtitle: "Move a disabled vehicle safely",
    summary: "Arrange a tow when a vehicle cannot be driven. Helpers coordinate pickup, safe loading, and transport to the destination you choose.",
    image: "/images/towing-service.png",
    priceFrom: 75,
    typicalDuration: "30-90 min",
    averageRating: 4.9,
    reviewCount: "11k+",
    highlights: ["Flatbed or hook tow", "Safe loading", "Destination drop-off"],
    includes: ["Vehicle loading", "Transport to destination", "Drop-off coordination"],
    addOns: ["Long-distance tow", "After-hours pickup", "Shop coordination"],
    searchTerms: ["tow", "towing", "recovery", "flatbed", "vehicle"],
  },
  handyman_help: {
    serviceType: "handyman_help",
    groupId: "home_services",
    groupLabel: "Home services",
    title: "Handyman Help",
    subtitle: "Furniture assembly and small repairs",
    summary: "Book practical help for mounting, setup, minor repairs, installation, and the odd fix that is not worth a full contractor visit.",
    image: "/images/handyman-service.png",
    priceFrom: 45,
    typicalDuration: "30-120 min",
    averageRating: 4.8,
    reviewCount: "14k+",
    highlights: ["Assembly and mounting", "Minor repairs", "Reliable tools"],
    includes: ["Furniture assembly", "Wall mounting", "Small fixture repair"],
    addOns: ["Extra hour", "Additional mounting", "Shopping pickup"],
    searchTerms: ["handyman", "repair", "mount", "assembly", "home"],
  },
  plumbing_help: {
    serviceType: "plumbing_help",
    groupId: "home_services",
    groupLabel: "Home services",
    title: "Plumbing Help",
    subtitle: "Leaks, clogs, and fixture swaps",
    summary: "Get support for leaks, clogged sinks, faucet problems, and non-emergency plumbing fixes in kitchens, bathrooms, and laundry areas.",
    image: "/images/plumbing-service.png",
    priceFrom: 55,
    typicalDuration: "30-90 min",
    averageRating: 4.9,
    reviewCount: "8k+",
    highlights: ["Leak inspection", "Drain clearing", "Fixture replacement"],
    includes: ["Pipe and leak review", "Drain unclogging", "Basic fixture install"],
    addOns: ["Sealant replacement", "Water pressure check", "Extra fixture install"],
    searchTerms: ["plumbing", "pipe", "sink", "faucet", "leak"],
  },
  electrical_help: {
    serviceType: "electrical_help",
    groupId: "home_services",
    groupLabel: "Home services",
    title: "Electrical Help",
    subtitle: "Safe, non-emergency electrical work",
    summary: "Request help for outlets, switches, lighting fixtures, and simple electrical troubleshooting with a focus on safety and clarity.",
    image: "/images/electric-service.png",
    priceFrom: 60,
    typicalDuration: "30-75 min",
    averageRating: 4.8,
    reviewCount: "7k+",
    highlights: ["Outlet and switch work", "Fixture installs", "Basic troubleshooting"],
    includes: ["Outlet inspection", "Switch replacement", "Light fixture setup"],
    addOns: ["Ceiling fan install", "Circuit review", "Extra fixture"],
    searchTerms: ["electric", "outlet", "switch", "light", "electrical"],
  },
  cleaning_help: {
    serviceType: "cleaning_help",
    groupId: "home_services",
    groupLabel: "Home services",
    title: "Cleaning Help",
    subtitle: "One-time or repeat cleaning support",
    summary: "Book a cleaning helper for a fresh reset, move-out cleanup, room-by-room touch-ups, or routine maintenance tasks.",
    image: "/images/cleaning-service.png",
    priceFrom: 40,
    typicalDuration: "60-180 min",
    averageRating: 4.7,
    reviewCount: "10k+",
    highlights: ["Surface cleaning", "Move-out support", "Flexible scheduling"],
    includes: ["Dusting", "Floor cleaning", "Kitchen and bath cleanup"],
    addOns: ["Deep-clean session", "Extra rooms", "Supply pickup"],
    searchTerms: ["clean", "cleaning", "housekeeping", "move out", "fresh"],
  },
  tech_help: {
    serviceType: "tech_help",
    groupId: "home_services",
    groupLabel: "Home services",
    title: "Tech Help",
    subtitle: "Device setup and troubleshooting",
    summary: "Get hands-on help for laptops, phones, routers, apps, and home devices when setup or troubleshooting gets annoying.",
    image: "/images/tech-help-service.png",
    priceFrom: 50,
    typicalDuration: "30-90 min",
    averageRating: 4.8,
    reviewCount: "5k+",
    highlights: ["Wi-Fi setup", "Device setup", "App troubleshooting"],
    includes: ["Phone or laptop setup", "Router help", "Basic software support"],
    addOns: ["Data transfer", "Printer setup", "Home office tune-up"],
    searchTerms: ["tech", "computer", "phone", "wifi", "setup"],
  },
  cna_support: {
    serviceType: "cna_support",
    groupId: "care_support",
    groupLabel: "Care and support",
    title: "CNA Support",
    subtitle: "Daily-care support with a personal touch",
    summary: "Arrange respectful daily assistance for routine care, reminders, wellness support, and basic home help for a family member.",
    image: "/images/cna-service.png",
    priceFrom: 65,
    typicalDuration: "60-240 min",
    averageRating: 4.9,
    reviewCount: "4k+",
    highlights: ["Daily routines", "Wellness check-ins", "Family updates"],
    includes: ["Routine support", "Medication reminders", "Basic companionship"],
    addOns: ["Recurring visits", "Meal support", "Appointment escort"],
    searchTerms: ["cna", "care", "daily support", "wellness", "home care"],
  },
  senior_helper: {
    serviceType: "senior_helper",
    groupId: "care_support",
    groupLabel: "Care and support",
    title: "Senior Helper",
    subtitle: "Errands and companionship for older adults",
    summary: "Book practical support for shopping, appointments, companionship, and light home help for seniors who need an extra hand.",
    image: "/images/senior-helper-service.png",
    priceFrom: 38,
    typicalDuration: "45-180 min",
    averageRating: 4.9,
    reviewCount: "6k+",
    highlights: ["Errands", "Companionship", "Routine help"],
    includes: ["Grocery help", "Appointment support", "Light chores"],
    addOns: ["Longer visits", "Weekend support", "Family check-in"],
    searchTerms: ["senior", "elder", "companionship", "errands", "support"],
  },
  pet_help: {
    serviceType: "pet_help",
    groupId: "care_support",
    groupLabel: "Care and support",
    title: "Pet Help",
    subtitle: "Walking, feeding, and pet check-ins",
    summary: "Get support for dogs, cats, and other pets with walking, feeding visits, transport, and basic care while you are away.",
    image: "/images/pet-help-service.png",
    priceFrom: 30,
    typicalDuration: "20-90 min",
    averageRating: 4.8,
    reviewCount: "7k+",
    highlights: ["Walking and feeding", "Transport", "Check-ins"],
    includes: ["Dog walking", "Feeding visits", "Quick wellness check"],
    addOns: ["Long walk", "Pet taxi", "Repeat visits"],
    searchTerms: ["pet", "dog", "cat", "animal", "walk"],
  },
  moving_help: {
    serviceType: "moving_help",
    groupId: "moving_errands",
    groupLabel: "Moving and errands",
    title: "Moving Help",
    subtitle: "Loading, lifting, and local moves",
    summary: "Book moving support for boxes, furniture, loading, unloading, and the smaller jobs that make a move feel manageable.",
    image: "/images/moving-help-service.png",
    priceFrom: 58,
    typicalDuration: "60-240 min",
    averageRating: 4.7,
    reviewCount: "9k+",
    highlights: ["Lifting and loading", "Local moves", "Team support"],
    includes: ["Box moving", "Furniture lifting", "Truck loading"],
    addOns: ["Two-person crew", "Packing support", "Extra hour"],
    searchTerms: ["moving", "lifting", "boxes", "load", "move"],
  },
  delivery_help: {
    serviceType: "delivery_help",
    groupId: "moving_errands",
    groupLabel: "Moving and errands",
    title: "Delivery Help",
    subtitle: "Pickup and drop-off for local errands",
    summary: "Send a helper for same-day pickup, short haul delivery, store runs, and small item drop-offs around town.",
    image: "/images/delivery-help-service.png",
    priceFrom: 24,
    typicalDuration: "20-60 min",
    averageRating: 4.8,
    reviewCount: "8k+",
    highlights: ["Same-day errands", "Pickup and drop-off", "Small parcel help"],
    includes: ["Pickup run", "Drop-off run", "Status updates"],
    addOns: ["Multi-stop route", "Signature drop-off", "Rush delivery"],
    searchTerms: ["delivery", "pickup", "drop", "errand", "parcel"],
  },
  others: {
    serviceType: "others",
    groupId: "moving_errands",
    groupLabel: "Flexible help",
    title: "General Help",
    subtitle: "Flexible support for custom requests",
    summary: "Describe the task and we will route it to the right helper when it does not fit a standard service.",
    image: "/images/roadside-work-hero.png",
    priceFrom: 35,
    typicalDuration: "30-120 min",
    averageRating: 4.6,
    reviewCount: "3k+",
    highlights: ["Custom task intake", "Flexible routing", "Support triage"],
    includes: ["Task review", "Service matching", "Support escalation"],
    addOns: ["Special handling", "Custom note", "Priority review"],
    searchTerms: ["general", "custom", "other", "help", "support"],
  },
} satisfies Record<ServiceType, ServiceCatalogEntry>;

export const serviceCatalogEntries = bookableServiceTypes.map((serviceType) => serviceCatalog[serviceType]);

export const serviceGroupFaqs: Record<ServiceGroupId, { question: string; answer: string }[]> = {
  roadside: [
    {
      question: "How quickly can a roadside partner arrive?",
      answer: "Most roadside requests are routed to the nearest available partner first, so the arrival window depends on traffic, location, and the service you chose.",
    },
    {
      question: "What if the fix is not enough?",
      answer: "If the helper cannot get the vehicle moving safely, the booking can continue into a tow or recovery flow and the job history keeps the full record.",
    },
  ],
  home_services: [
    {
      question: "Can I book the same day?",
      answer: "Yes. We surface partners who are available now or soon, then let you schedule a time that works better if the task is planned.",
    },
    {
      question: "Do helpers bring tools?",
      answer: "Helpers are expected to arrive prepared for the service type, and the booking detail shows the task notes and address before they accept.",
    },
  ],
  care_support: [
    {
      question: "Can family book on behalf of someone else?",
      answer: "Yes. The booking can be created for another household member as long as the address, notes, and access instructions are clear.",
    },
    {
      question: "Can I arrange repeat visits?",
      answer: "Yes. The schedule can be reused for recurring support, and the job history keeps everything visible for follow-up and payout tracking.",
    },
  ],
  moving_errands: [
    {
      question: "Can I book by the hour?",
      answer: "You can describe the scope and choose a time window so the helper knows whether the task is a short errand or a longer moving session.",
    },
    {
      question: "What if I need extra stops?",
      answer: "Add the details in the booking notes and the helper can decide whether the route needs a longer slot or an adjusted fee.",
    },
  ],
};

export function getServiceCatalogEntry(serviceType: ServiceType) {
  return serviceCatalog[serviceType];
}

export function getServiceGroup(serviceType: ServiceType) {
  return serviceGroups.find((group) => group.serviceTypes.includes(serviceType));
}

export function matchesServiceSearch(entry: ServiceCatalogEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    entry.title,
    entry.subtitle,
    entry.summary,
    entry.groupLabel,
    ...entry.highlights,
    ...entry.includes,
    ...entry.addOns,
    ...entry.searchTerms,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}
