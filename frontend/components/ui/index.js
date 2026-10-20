// The Rock Works primitives.

import Link from "next/link";
import s from "./ui.module.css";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// The measure.
export function Container({ width = "wide", className, children, ...rest }) {
  return (
    <div className={cx(s.container, s[width], className)} {...rest}>
      {children}
    </div>
  );
}

// Vertical rhythm plus an optional full-bleed ground.
export function Section({ band, tight, width = "wide", className, children, ...rest }) {
  const bandClass = band === "sand" ? s.bandSand : band === "ink" ? s.bandInk : null;
  return (
    <section className={cx(bandClass, className)} {...rest}>
      <Container width={width} className={tight ? s.sectionTight : s.section}>
        {children}
      </Container>
    </section>
  );
}

// Slab title, uppercase teal eyebrow, hairline rule.
export function SectionHead({ title, eyebrow, onDark, flush, as: Tag = "h2", className }) {
  return (
    <div className={cx(s.head, flush && s.headFlush, onDark && s.onDark, className)}>
      <Tag className={s.headTitle}>{title}</Tag>
      {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
    </div>
  );
}

// An eyebrow with no heading beside it, for bands that open on a label.
export function Eyebrow({ children, className }) {
  return <div className={cx(s.eyebrowSolo, className)}>{children}</div>;
}

// The dark banner at the top of a page, with the wave cut into its foot.
export function PageHero({ title, eyebrow, lead, compact, mark, children }) {
  return (
    <section className={cx(s.hero, compact && s.heroCompact)}>
      <div className={s.heroInner}>
        {mark && <div className={s.heroMark}>{mark}</div>}
        {eyebrow && <div className={s.heroEyebrow}>{eyebrow}</div>}
        <h1 className={s.heroTitle}>{title}</h1>
        {lead && <p className={s.heroLead}>{lead}</p>}
        {children}
      </div>
      <div className={s.heroWave} aria-hidden="true">
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" fill="var(--rw-cream)" />
        </svg>
      </div>
    </section>
  );
}

export function Button({
  href,
  variant = "primary",
  size = "md",
  onDark,
  className,
  children,
  ...rest
}) {
  const cls = cx(s.btn, s[size], s[variant], onDark && s.onDarkBtn, className);
  if (href) {
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Card({ lift, className, children, ...rest }) {
  return (
    <div className={cx(s.card, lift && s.cardLift, className)} {...rest}>
      {children}
    </div>
  );
}

export function Prose({ className, children, ...rest }) {
  return (
    <div className={cx(s.prose, className)} {...rest}>
      {children}
    </div>
  );
}

export { s as ui };
