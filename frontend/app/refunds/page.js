import LegalPage, { H2, P, UL, Todo } from "@/components/LegalPage";

export const metadata = {
  title: "Refund and Cancellation Policy — Rock Works School of Music",
  description: "How to cancel a Rock Works membership and where we stand on refunds.",
};

export default function Refunds() {
  return (
    <LegalPage
      title="Refund &amp; Cancellation Policy"
      lastUpdated="6 August 2026"
      intro="How to stop a membership, what happens when you do, and where we stand on refunds."
    >
      <H2>How to cancel</H2>
      <P>
        Sign in, go to <strong>Settings</strong>, and choose <strong>Cancel membership</strong>.
        It takes effect straight away — you don&apos;t need to phone or email anyone, and no
        one has to approve it.
      </P>

      <H2>What happens next</H2>
      <UL>
        <li>You keep full access until the end of the period you have already paid for.</li>
        <li>You are not charged again.</li>
        <li>
          On a monthly membership, access runs to the end of the current month. On a
          three-month term, it runs to the end of that term.
        </li>
        <li>
          Changed your mind? While that period is still running you can undo the cancellation
          from the same Settings page, and the membership carries on as before.
        </li>
      </UL>
      <P>
        Your Settings page always shows the exact date your access ends, or the date of the
        next charge if you haven&apos;t cancelled.
      </P>

      <H2>Refunds</H2>
      <P>
        Because cancelling always leaves you with the access you paid for, membership charges
        are not normally refunded — including the unused part of a three-month term cancelled
        partway through.
      </P>
      <P>We will refund you where:</P>
      <UL>
        <li>You were charged in error, or charged twice for the same period.</li>
        <li>We close your account for a reason other than a serious breach of the terms — then we refund the unused part.</li>
        <li>
          <Todo>any other circumstances the school wants to offer refunds in — for example a
          first-time trial period, a cooling-off window after the first payment, or medical
          and family circumstances. Worth deciding deliberately: a stated goodwill policy
          reduces card disputes</Todo>
        </li>
      </UL>
      <P>
        To ask about a refund, email denny.landika@rockworksschoolofmusichawaii.com with the
        date and amount of the charge. Approved refunds go back to the card you paid with,
        and usually take five to ten business days to appear.
      </P>

      <H2>Lessons are separate</H2>
      <P>
        This policy covers <strong>membership of this website</strong> only. Music lessons are
        arranged and paid for separately with the school, and cancelling a membership does not
        cancel a lesson, or vice versa.
      </P>
      <P>
        <Todo>the school&apos;s policy on missed, cancelled and rescheduled lessons — this
        sits outside the website, but students will look for it here</Todo>
      </P>

      <H2>Failed payments</H2>
      <P>
        If a renewal payment fails, Stripe retries it over the following days and emails you.
        If it still cannot be collected, the membership ends and access closes. You can re-join
        at any time, and your practice history is still there when you do.
      </P>

      <H2>Price changes</H2>
      <P>
        A period you have already paid for is never repriced. If the price of a membership
        changes, we will tell you before it affects a renewal, so you can cancel first if you
        would rather not continue.
      </P>

      <H2>Questions</H2>
      <P>
        Email denny.landika@rockworksschoolofmusichawaii.com or use the{" "}
        <a href="/contact" style={{ color: "var(--rw-teal)", fontWeight: 600 }}>contact form</a>.
        If something looks wrong on your bill, please talk to us before disputing it with your
        bank — it is almost always quicker to sort out directly.
      </P>
    </LegalPage>
  );
}
