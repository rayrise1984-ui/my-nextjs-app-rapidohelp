import { hasSupabaseBrowserConfig } from "@/lib/supabase";
import { bookableServiceTypes, type ServiceType } from "@/lib/marketplace";
import { LoginLinks } from "@/components/login-links";
import Link from "next/link";

const serviceCards = [
  {
    id: "flat_tire",
    image: "/images/roadside-work-hero.png",
    title: "Flat Tire Fix",
    detail: "For punctures, low tire pressure, spare tire swaps, and roadside wheel help when you are stuck.",
  },
  {
    id: "jump_start",
    image: "/images/jump-start-service.png",
    title: "Jump Start",
    detail: "For dead batteries, jumper pack help, quick battery checks, and getting your car started safely.",
  },
  {
    id: "fuel_delivery",
    image: "/images/fuel-delivery-service.png",
    title: "Fuel Delivery",
    detail: "For empty-tank situations when you need approved fuel brought to your parked vehicle.",
  },
  {
    id: "towing",
    image: "/images/towing-service.png",
    title: "Towing",
    detail: "For vehicles that cannot be driven and need transport to home, a shop, or another safe location.",
  },
  {
    id: "moving_help",
    image: "/images/moving-help-service.png",
    title: "Moving Help",
    detail: "For lifting boxes, loading small moves, carrying furniture, and short local moving tasks.",
  },
  {
    id: "handyman_help",
    image: "/images/handyman-service.png",
    title: "Handyman Help",
    detail: "For furniture assembly, minor repairs, mounting, setup, and practical home fixes.",
  },
  {
    id: "plumbing_help",
    image: "/images/plumbing-service.png",
    title: "Plumbing Help",
    detail: "For leaks, clogged sinks, faucet issues, fixture swaps, and quick non-emergency plumbing tasks.",
  },
  {
    id: "electrical_help",
    image: "/images/electric-service.png",
    title: "Electrical Help",
    detail: "For outlets, switches, light fixtures, basic checks, and safe non-emergency electrical help.",
  },
  {
    id: "cna_support",
    image: "/images/cna-service.png",
    title: "CNA Support",
    detail: "For non-emergency daily-care support, reminders, wellness checks, and basic home assistance.",
  },
  {
    id: "senior_helper",
    image: "/images/senior-helper-service.png",
    title: "Senior Helper",
    detail: "For errands, light chores, companionship, grocery help, and daily routine support for seniors.",
  },
  {
    id: "cleaning_help",
    image: "/images/cleaning-service.png",
    title: "Cleaning Help",
    detail: "For home or office tidying, surface cleaning, move-out cleanup, and quick refresh jobs.",
  },
  {
    id: "delivery_help",
    image: "/images/delivery-service.png",
    title: "Delivery Help",
    detail: "For local pickup, parcel drop-off, errands, and same-day delivery of small items.",
  },
  {
    id: "pet_help",
    image: "/images/pet-help-service.png",
    title: "Pet Help",
    detail: "For dog walking, pet transport, feeding visits, and basic pet-care support.",
  },
  {
    id: "tech_help",
    image: "/images/tech-help-service.png",
    title: "Tech Help",
    detail: "For laptop setup, phone help, Wi-Fi/router setup, software basics, and device troubleshooting.",
  },
];

export default function HomePage() {
  const supabaseConfigured = hasSupabaseBrowserConfig();
  const visibleServiceCards = serviceCards.filter((service) =>
    bookableServiceTypes.includes(service.id as ServiceType),
  );

  return (
    <main className="page-shell">
      <header className="public-topbar">
        <Link className="public-brand" href="/">
          RapidoHelp
        </Link>
        <LoginLinks />
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Happy to help, anytime, anywhere, always</p>
          <h1>RapidoHelp</h1>
          <p className="lead">
            Flat tire, dead battery, fuel delivery, towing, and urgent local tasks handled by nearby helpers.
          </p>
          <div className="status-row">
            <span className={supabaseConfigured ? "status ok" : "status warn"}>
              {supabaseConfigured
                ? "Create a profile to get started"
                : "Create a profile to get started"}
            </span>
            {supabaseConfigured && (
              <>
                <Link className="cta-link" href="/dashboard">
                  Book help now
                </Link>
                <Link className="cta-link" href="/auth">
                  Sign up
                </Link>
              </>
            )}
            {!supabaseConfigured && (
              <Link className="cta-link" href="/auth">
                Sign up
              </Link>
            )}
          </div>
        </div>

        <div className="help-options" aria-label="Booking options">
          <Link href="/dashboard">
            <strong>Roadside help</strong>
            <span>Book tire, battery, fuel, or towing support.</span>
          </Link>
          <Link href="/dashboard">
            <strong>Home and local tasks</strong>
            <span>Post moving, handyman, cleaning, delivery, tech, or pet help.</span>
          </Link>
          <Link href="/auth">
            <strong>Sign up</strong>
            <span>Start a customer or helper account before you sign in.</span>
          </Link>
        </div>
      </section>

      <section className="grid">
        {visibleServiceCards.map((service) => (
          <Link className="card" href={`/dashboard?service=${service.id}`} key={service.id}>
            <img src={service.image} alt="" />
            <h2>{service.title}</h2>
            <p>{service.detail}</p>
            <span>Book this service</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
