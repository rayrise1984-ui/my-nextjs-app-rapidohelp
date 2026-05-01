import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoginLinks } from "@/components/login-links";
import {
  bookableServiceTypes,
  type ServiceType,
} from "@/lib/marketplace";
import {
  getServiceCatalogEntry,
  serviceGroupFaqs,
} from "@/lib/service-catalog";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export function generateStaticParams() {
  return bookableServiceTypes.map((serviceType) => ({ serviceType }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    serviceType: string;
  }>;
}): Promise<Metadata> {
  const { serviceType } = await params;
  const entry = getServiceCatalogEntry(serviceType as ServiceType);

  if (!entry || !bookableServiceTypes.includes(serviceType as ServiceType)) {
    return {
      title: "Service not found | RapidoHelp",
    };
  }

  return {
    title: `${entry.title} | RapidoHelp`,
    description: entry.summary,
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{
    serviceType: string;
  }>;
}) {
  const { serviceType } = await params;
  const entry = getServiceCatalogEntry(serviceType as ServiceType);

  if (!entry || !bookableServiceTypes.includes(serviceType as ServiceType)) {
    notFound();
  }

  const faqs = serviceGroupFaqs[entry.groupId];

  return (
    <main className="page-shell service-detail-shell">
      <header className="public-topbar">
        <Link className="public-brand" href="/">
          RapidoHelp
        </Link>
        <LoginLinks />
      </header>

      <section className="service-detail-hero">
        <div className="service-detail-copy">
          <p className="eyebrow">{entry.groupLabel}</p>
          <h1>{entry.title}</h1>
          <p className="lead">{entry.summary}</p>

          <div className="marketplace-pill-row">
            <span className="marketplace-pill">
              <strong>{formatPrice(entry.priceFrom)}</strong>
              <span>Starting price</span>
            </span>
            <span className="marketplace-pill">
              <strong>{entry.typicalDuration}</strong>
              <span>Typical visit</span>
            </span>
            <span className="marketplace-pill">
              <strong>{entry.averageRating.toFixed(1)}</strong>
              <span>{entry.reviewCount} ratings</span>
            </span>
          </div>

          <div className="marketplace-actions">
            <Link className="cta-link" href={`/dashboard?service=${entry.serviceType}`}>
              Book this service
            </Link>
            <Link className="cta-link secondary" href="/auth?account=customer">
              Create customer profile
            </Link>
            <Link className="cta-link secondary" href="/auth?account=helper">
              Join as service partner
            </Link>
          </div>

          <div className="service-detail-summary">
            <strong>Highlights</strong>
            <p>{entry.highlights.join(" · ")}</p>
          </div>
        </div>

        <aside className="service-detail-aside">
          <img alt="" src={entry.image} />
          <div className="service-detail-panel">
            <div>
              <strong>What you get</strong>
              <p>{entry.subtitle}</p>
            </div>
            <div>
              <strong>Included</strong>
              <p>{entry.includes.join(" · ")}</p>
            </div>
            <div>
              <strong>Add-ons</strong>
              <p>{entry.addOns.join(" · ")}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="marketplace-band marketplace-band-split">
        <div className="marketplace-band-copy">
          <p className="eyebrow">What is included</p>
          <h2>Service scope and support</h2>
          <p>
            The booking keeps the service address, schedule, partner assignment, payment choice,
            and job history together so the work stays easy to track.
          </p>
        </div>

        <div className="marketplace-benefits">
          {entry.includes.map((item) => (
            <div key={item}>
              <strong>{item}</strong>
              <span>Included in the service flow and visible in the booking record.</span>
            </div>
          ))}
        </div>
      </section>

      <section className="marketplace-band marketplace-band-split">
        <div className="marketplace-band-copy">
          <p className="eyebrow">Common add-ons</p>
          <h2>Extra help if the job needs more time</h2>
          <p>
            Helpers can see the job notes, address, and timing up front, which makes it easier to
            agree on extra scope before the work starts.
          </p>
        </div>

        <div className="marketplace-benefits">
          {entry.addOns.map((item) => (
            <div key={item}>
              <strong>{item}</strong>
              <span>Optional add-on that can be folded into the booking.</span>
            </div>
          ))}
        </div>
      </section>

      <section className="marketplace-band">
        <div className="marketplace-band-copy">
          <p className="eyebrow">How booking works</p>
          <h2>Simple, three-step booking flow</h2>
        </div>

        <div className="marketplace-stepgrid">
          <div>
            <strong>1. Choose the service</strong>
            <span>Open the service page and confirm what you need help with.</span>
          </div>
          <div>
            <strong>2. Add your details</strong>
            <span>Set the address, time, and payment preference before you post.</span>
          </div>
          <div>
            <strong>3. Confirm the job</strong>
            <span>The request routes to a verified partner and the history stays in your profile.</span>
          </div>
          <div>
            <strong>4. Rate the result</strong>
            <span>After completion, customers can review the helper and keep the record forever.</span>
          </div>
        </div>
      </section>

      <section className="marketplace-band marketplace-band-split">
        <div className="marketplace-band-copy">
          <p className="eyebrow">Questions people ask</p>
          <h2>Common booking questions</h2>
        </div>

        <div className="marketplace-benefits">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <strong>{faq.question}</strong>
              <span>{faq.answer}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="marketplace-band marketplace-band-split">
        <div className="marketplace-band-copy">
          <p className="eyebrow">Ready to book</p>
          <h2>Move from service discovery to completed work</h2>
          <p>
            Create a customer profile to post the job, or create a service partner profile if you
            want to join the marketplace and earn from accepted jobs.
          </p>
        </div>

        <div className="marketplace-actions marketplace-actions-inline">
          <Link className="cta-link" href={`/dashboard?service=${entry.serviceType}`}>
            Start booking
          </Link>
          <Link className="cta-link secondary" href="/auth?account=customer">
            Customer sign up
          </Link>
          <Link className="cta-link secondary" href="/auth?account=helper">
            Helper sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
