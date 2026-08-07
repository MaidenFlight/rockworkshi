import LegalPage, { H2, P, UL, Todo } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy — Rock Works School of Music",
  description: "What Rock Works School of Music collects, why, and who it is shared with.",
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="6 August 2026"
      intro="This explains what this site collects, why, and who else sees it. It describes what the software actually does, not what we might one day do."
    >
      <H2>The short version</H2>
      <UL>
        <li>We collect what we need to run your membership, and not much else.</li>
        <li>
          <strong>There are no analytics, advertising or tracking tools on this site.</strong>{" "}
          No Google Analytics, no advertising pixels, no third-party cookies.
        </li>
        <li>We never see your card number.</li>
        <li>We don&apos;t sell your information, and we don&apos;t send marketing email.</li>
      </UL>

      <H2>What we collect</H2>
      <P><strong>When you create an account:</strong></P>
      <UL>
        <li>Your email address, and a password stored only as a one-way hash — we cannot read it.</li>
        <li>Your name, age, phone number and whether you are under 18.</li>
        <li>For a student under 18, the name and email of their parent or guardian.</li>
        <li>Your instrument, experience, level, preferred format of instruction, and the name of anyone learning alongside you.</li>
        <li>Which membership plan you chose.</li>
      </UL>

      <P><strong>As you use the member area:</strong></P>
      <UL>
        <li>Practice statistics — minutes practised, goals, streaks and achievements.</li>
        <li>A session cookie that keeps you signed in.</li>
      </UL>

      <P><strong>When you pay:</strong></P>
      <UL>
        <li>A record of each payment: the plan, amount, currency and date, and Stripe&apos;s reference for it.</li>
        <li>Stripe&apos;s customer and subscription identifiers, so renewals can be matched to your account.</li>
        <li>
          <strong>No card details.</strong> Your card number, expiry and security code are typed
          on Stripe&apos;s own payment page and never reach this site&apos;s servers.
        </li>
      </UL>

      <P><strong>If you ask about a trial lesson or use the contact form:</strong></P>
      <UL>
        <li>The student&apos;s name and age, a guardian&apos;s name, an email address and phone number.</li>
        <li>Instrument, format, experience, availability, favourite music, goals and any notes you add.</li>
      </UL>

      <H2>Why we hold it</H2>
      <UL>
        <li>To give you access to your membership and keep you signed in.</li>
        <li>To take payment and manage renewals and cancellations.</li>
        <li>To confirm your email address and let you reset a forgotten password.</li>
        <li>To arrange and run lessons, and to reply when you contact us.</li>
        <li>To keep records we are required to keep, such as records of payment.</li>
      </UL>

      <H2>Email we send</H2>
      <P>
        We send email about your account only: confirming your address, resetting your
        password, and telling you when your password has been changed. We do not send
        newsletters or marketing, so there is nothing to unsubscribe from.
      </P>

      <H2>Cookies</H2>
      <P>
        This site sets <strong>one</strong> cookie. It holds a session identifier so the site
        knows you are signed in, and nothing else — no advertising or analytics cookie is set,
        by us or anyone else. It is marked HttpOnly and Secure, so it cannot be read by
        scripts in your browser and only travels over an encrypted connection. It lasts seven
        days, or until you sign out.
      </P>

      <H2>Who else sees your information</H2>
      <P>
        We do not sell your information or share it for advertising. We use a small number of
        service providers to run the site, and each sees only what its job requires:
      </P>
      <UL>
        <li><strong>Stripe</strong> — payments. Stripe receives your email and payment details and handles the card itself.</li>
        <li><strong>Resend</strong> — sends the account emails described above.</li>
        <li><strong>Neon</strong> — hosts the database holding your account.</li>
        <li><strong>Render</strong> — runs the application.</li>
        <li><strong>Netlify</strong> — serves this website.</li>
      </UL>
      <P>
        We may also disclose information where the law requires it, or to protect someone&apos;s
        safety. All of these providers store data in the United States.
      </P>

      <H2>How long we keep it</H2>
      <P>
        Your account and its details are kept while your account is open. If you close it, we
        delete your account details but keep records of payments for as long as tax and
        accounting rules require. Trial and contact enquiries are kept{" "}
        <Todo>retention period for enquiries the school never took up</Todo>.
      </P>

      <H2>Keeping it safe</H2>
      <UL>
        <li>The whole site is served over HTTPS.</li>
        <li>Passwords are stored as one-way hashes, never as text we could read.</li>
        <li>Email confirmation and password-reset links are stored hashed, expire, and work only once.</li>
        <li>Changing your password signs out every other device.</li>
      </UL>
      <P>
        No system is perfectly secure, but we take these measures seriously and will tell you
        promptly if something goes wrong with your data.
      </P>

      <H2>Your choices</H2>
      <P>
        You can see and change your name, instrument and phone number on your Settings page at
        any time. To ask for a copy of what we hold, to correct something, or to have your
        account deleted, email denny.landika@rockworksschoolofmusichawaii.com and we will
        respond within <Todo>response time commitment — 30 days is the usual standard</Todo>.
      </P>
      <P>
        <Todo>state privacy law rights — a lawyer should confirm which apply, since laws such
        as California&apos;s CCPA/CPRA can cover a Hawaii business with customers in those
        states, and each carries its own required wording</Todo>
      </P>

      <H2>Children</H2>
      <P>
        The school teaches students from a young age, and a parent or guardian signs up and
        manages the account for any student under 18.
      </P>
      <P>
        <Todo>children&apos;s privacy — US federal law (COPPA) governs collecting personal
        information from children under 13 and requires verifiable parental consent. This
        section must be written by a lawyer, and it may change how young a student can hold
        their own account</Todo>
      </P>

      <H2>Changes</H2>
      <P>
        If we change this policy we will update the date at the top, and tell you by email if
        the change materially affects you.
      </P>

      <H2>Contact</H2>
      <P>
        Rock Works School of Music, <Todo>legal entity name</Todo>,{" "}
        <Todo>business mailing address</Todo>.<br />
        denny.landika@rockworksschoolofmusichawaii.com
      </P>
    </LegalPage>
  );
}
