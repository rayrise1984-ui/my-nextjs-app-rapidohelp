import Link from "next/link";

import { LoginLinks } from "@/components/login-links";
import { serviceCatalog, serviceCatalogEntries, serviceGroups, matchesServiceSearch } from "@/lib/service-catalog";

type SearchParams = Record<string, string | string[] | undefined>;

const firstParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const formatPrice = (value: number) => {
  if (value <= 0) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const homeStats = [
  { value: "24/7", label: "Booking and support" },
  { value: "Verified", label: "Partner review" },
  { value: "Fast", label: "Live matching" },
  { value: "Rated", label: "Post-job reviews" },
];

export default function HomePage({ searchParams }: { searchParams?: SearchParams }) {
  const query = firstParam(searchParams?.q).trim();
  const selectedGroup = firstParam(searchParams?.group).trim();
  const normalizedGroup = selectedGroup && selectedGroup !== "all" ? selectedGroup : "all";
  const featuredServices = serviceCatalogEntries.slice(0, 3);

  const groupsToRender = serviceGroups
    .map((group) => {
      const services = group.serviceTypes
        .map((serviceType) => serviceCatalog[serviceType])
        .filter((service) => normalizedGroup === "all" || service.groupId === normalizedGroup)
        .filter((service) => matchesServiceSearch(service, query));

      return { group, services };
    })
    .filter(({ services }) => services.length > 0);

  const hasFilters = Boolean(query || normalizedGroup !== "all");

  return (
    <main className="page-shell marketplace-shell">
      <header className="public-topbar marketplace-topbar">
        <Link className="public-brand" href="/">
          RapidoHelp
        </Link>
        <LoginLinks />
      </header>

      <section className="marketplace-hero">
        <div className="marketplace-hero-copy">
          <p className="eyebrow">UrbanClap-style local services</p>
          <h1>Book trusted help in minutes</h1>
          <p className="lead">
            Search categories, compare service partners, schedule a visit, and keep the full job
            history, payment, and ratings in one account.
          </p>

          <div className="marketplace-pill-row" aria-label="Trust signals">
            {homeStats.map((stat) => (
              <span className="marketplace-pill" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </span>
            ))}
          </div>

          <form className="marketplace-search" method="get">
            <label className="marketplace-search-field">
              <span>Search services</span>
              <input
                aria-label="Search services"
                defaultValue={query}
                name="q"
                placeholder="Plumbing, towing, cleaning, handyman..."
                type="search"
              />
            </label>

            <label className="marketplace-search-field">
              <span>Category</span>
              <select aria-label="Service group" defaultValue={normalizedGroup} name="group">
                <option value="all">All categories</option>
                {serviceGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="cta-link marketplace-search-submit" type="submit">
              Search
            </button>

            {hasFilters ? (
              <Link className="cta-link secondary marketplace-search-reset" href="/">
                Clear
              </Link>
            ) : null}
          </form>

          <div className="marketplace-actions">
            <Link className="cta-link" href="/auth?account=customer">
              Create customer profile
            </Link>
            <Link className="cta-link secondary" href="/auth?account=helper">
              Join as service partner
            </Link>
          </div>
        </div>

        <aside className="marketplace-hero-side" aria-label="Popular services">
          <div className="marketplace-side-panel">
            <p className="eyebrow">Popular right now</p>
            <div className="marketplace-featured-list">
              {featuredServices.map((service) => (
                <Link
                  className="marketplace-featured-item"
                  href={`/services/${service.serviceType}`}
                  key={service.serviceType}
                >
                  <img alt="" src={service.image} />
                  <div>
                    <strong>{service.title}</strong>
                    <span>{service.groupLabel}</span>
                    <span>
                      From {formatPrice(service.priceFrom)} · {service.typicalDuration}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="marketplace-side-statgrid">
              <div>
                <strong>Verified partners</strong>
                <span>Partner access goes through review and approval.</span>
              </div>
              <div>
                <strong>Live matching</strong>
                <span>Requests route to nearby available helpers and partner offers.</span>
              </div>
              <div>
                <strong>Flexible payment</strong>
                <span>Card, UPI, and cash are supported across booking flows.</span>
              </div>
              <div>
                <strong>Job history</strong>
                <span>Customers and helpers keep a complete record of the work.</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <nav className="marketplace-chip-rail" aria-label="Browse categories">
        <Link className={normalizedGroup === "all" ? "marketplace-chip active" : "marketplace-chip"} href="/">
          All categories
        </Link>
        {serviceGroups.map((group) => {
          const href = `/?group=${encodeURIComponent(group.id)}`;
          return (
            <Link
              className={normalizedGroup === group.id ? "marketplace-chip active" : "marketplace-chip"}
              href={href}
              key={group.id}
            >
              {group.label}
            </Link>
          );
        })}
      </nav>

      <section className="marketplace-band">
        <div className="marketplace-band-copy">
          <p className="eyebrow">How it works</p>
          <h2>Built like a service marketplace, not a contact form</h2>
          <p>
            Browse the service catalog, pick a category, choose a time, add a service address,
            and send the job to a verified partner or a preferred helper.
          </p>
        </div>
        <div className="marketplace-stepgrid">
          <div>
            <strong>1. Choose a service</strong>
            <span>Search the catalog or tap a category to open the service page.</span>
          </div>
          <div>
            <strong>2. Set the booking</strong>
            <span>Add the address, time, and payment preference.</span>
          </div>
          <div>
            <strong>3. Match a partner</strong>
            <span>We route the job to a verified service partner or your preferred helper.</span>
          </div>
          <div>
            <strong>4. Track the work</strong>
            <span>Both sides keep the full job history, payout record, and review trail.</span>
          </div>
        </div>
      </section>

      <section id="services" className="marketplace-sections">
        {groupsToRender.length > 0 ? (
          groupsToRender.map(({ group, services }) => (
            <section className="marketplace-group" key={group.id}>
              <div className="marketplace-group-header">
                <div>
                  <p className="eyebrow">{group.label}</p>
                  <h2>{group.label}</h2>
                  <p>{group.description}</p>
                </div>
                <Link className="text-link" href={`/?group=${encodeURIComponent(group.id)}`}>
                  View only this group
                </Link>
              </div>

              <div className="service-grid">
                {services.map((service) => (
                  <Link className="service-tile" href={`/services/${service.serviceType}`} key={service.serviceType}>
                    <img alt="" src={service.image} />
                    <div className="service-tile-body">
                      <div className="service-tile-meta">
                        <span className="service-tile-badge">{service.groupLabel}</span>
                        <span>{service.reviewCount} reviews</span>
                      </div>
                      <h3>{service.title}</h3>
                      <p>{service.summary}</p>
                      <div className="service-tile-footer">
                        <span>
                          From {formatPrice(service.priceFrom)} · {service.typicalDuration}
                        </span>
                        <strong>View details</strong>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="empty-state marketplace-empty">
            No services match that search yet. Try another category or clear the filters.
          </div>
        )}
      </section>

      <section className="marketplace-band marketplace-band-split">
        <div className="marketplace-band-copy">
          <p className="eyebrow">Why people stay</p>
          <h2>Trust, routing, and records in one place</h2>
          <p>
            Every job carries the address, schedule, payment preference, partner assignment,
            ratings, and completion history so customers and helpers can both see what happened.
          </p>
        </div>

        <div className="marketplace-benefits">
          <div>
            <strong>For customers</strong>
            <span>Browse service pages, book a visit, track progress, and rate the result.</span>
          </div>
          <div>
            <strong>For service partners</strong>
            <span>Accept nearby offers, manage availability, and review earnings and payouts.</span>
          </div>
          <div>
            <strong>For admins</strong>
            <span>Review profiles, approve partners, monitor jobs, and resolve support issues.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
