import LegalPage, { H2, P, UL, Todo } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service — Rock Works School of Music",
  description: "The terms that apply to a Rock Works School of Music membership.",
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="6 August 2026"
      intro="These terms cover your use of this website and the membership sold through it. Please read them before signing up — creating an account means you accept them."
    >
      <H2>Who you are dealing with</H2>
      <P>
        This site is operated by Rock Works School of Music, <Todo>legal entity name and
        state of registration</Todo>, of <Todo>business mailing address</Todo>. You can
        reach us at denny.landika@rockworksschoolofmusichawaii.com or through the contact
        form on this site.
      </P>

      <H2>What a membership buys</H2>
      <P>
        A membership gives you access to the member area of this website: lesson material,
        the song library, practice tools and your progress dashboard. It is access to the
        site itself.
      </P>
      <P>
        <strong>A membership is not music lessons.</strong> Teaching is arranged separately
        with the school and charged separately. Paying for a membership does not book,
        reserve or pay for any lesson, and cancelling a membership does not cancel any
        lesson arrangement you have made — or the other way round.
      </P>

      <H2>Accounts</H2>
      <UL>
        <li>You need a working email address, and you must confirm it before your account is fully active.</li>
        <li>Keep your password to yourself. Anything done through your account is treated as done by you.</li>
        <li>An account is for one person. Please don&apos;t share logins.</li>
        <li>Tell us promptly if you think someone else has got into your account.</li>
      </UL>

      <H2>Students under 18</H2>
      <P>
        A student under 18 must be signed up by a parent or guardian, who gives their own
        name and email during signup and is responsible for the account and its charges.
      </P>
      <P>
        <Todo>minimum age decision — the school teaches from age 5, and US federal law
        (COPPA) sets specific requirements for collecting personal information from
        children under 13. A lawyer should confirm the minimum age for holding an account
        and what parental consent has to look like</Todo>
      </P>

      <H2>Prices, billing and renewal</H2>
      <UL>
        <li>Monthly membership is $55.00, charged every month.</li>
        <li>Term membership is $135.00, charged once for a three-month term.</li>
        <li>
          <strong>Both renew automatically</strong> — monthly on the same date each month,
          term at the end of each three-month period — until you cancel.
        </li>
        <li>Prices are in US dollars and shown before you pay.</li>
        <li>
          We may change prices, but not for a period you have already paid for, and we will
          tell you <Todo>notice period for price changes</Todo> beforehand.
        </li>
      </UL>
      <P>
        Payments are handled by Stripe. Your card details go directly to Stripe and are
        never seen or stored by this site.
      </P>

      <H2>Cancelling</H2>
      <P>
        You can cancel at any time from the Settings page of your account — no phone call,
        no email required. Your membership then runs to the end of the period you have
        already paid for and does not renew. Full details, including our position on
        refunds, are in the <a href="/refunds" style={linkStyle}>Refund and Cancellation Policy</a>.
      </P>

      <H2>Using the site properly</H2>
      <P>Please don&apos;t:</P>
      <UL>
        <li>Copy, record, redistribute or resell the lesson material or song library.</li>
        <li>Share your account so others can use it without paying.</li>
        <li>Try to break, overload or gain unauthorised access to the site.</li>
        <li>Upload anything unlawful, or anything you don&apos;t have the rights to.</li>
      </UL>

      <H2>Who owns what</H2>
      <P>
        The site, its lesson material and its design belong to the school or its licensors.
        Your membership is permission to use them personally while it lasts, not a transfer
        of ownership. Songs and recordings referenced in the library remain the property of
        their own rights holders.
      </P>

      <H2>Ending an account</H2>
      <P>
        You may close your account at any time. We may suspend or close an account that
        breaks these terms or is used to harm other people, and where we do that for a
        reason other than a serious breach, we will refund the unused part of any period
        you have paid for.
      </P>

      <H2>Things we can&apos;t promise</H2>
      <P>
        We work to keep the site available and accurate, but we can&apos;t promise it will
        never be offline or never contain a mistake. Progress in music depends on practice
        and teaching, and nothing here is a promise of any particular result.
      </P>
      <P>
        <Todo>limitation of liability and warranty disclaimer — a lawyer should draft
        these to match Hawaii law and the school&apos;s insurance</Todo>
      </P>

      <H2>Changes to these terms</H2>
      <P>
        We may update these terms. If a change materially affects you, we will let you know
        by email before it takes effect, and the date at the top of this page will change.
        Continuing to use your membership after that means accepting the new version.
      </P>

      <H2>Governing law</H2>
      <P>
        <Todo>governing law and where disputes are settled — normally the State of Hawaii,
        but this needs a lawyer&apos;s confirmation, along with whether to include an
        arbitration clause</Todo>
      </P>

      <H2>Getting in touch</H2>
      <P>
        Questions about these terms: denny.landika@rockworksschoolofmusichawaii.com, or the{" "}
        <a href="/contact" style={linkStyle}>contact form</a>.
      </P>
    </LegalPage>
  );
}

const linkStyle = { color: "var(--rw-teal)", fontWeight: 600 };
