import { Link } from "@tanstack/react-router";
import { PublicPage, Prose } from "@/components/PublicPage";
import { LEGAL_UPDATED, OPERATOR } from "@/shared/site";

export function Privacy() {
  const mail = OPERATOR.email ? <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> : <Link to="/contact">the contact page</Link>;
  return (
    <PublicPage
      title="Privacy policy"
      intro={
        <>
          What smartbeavers stores about you, why, and how to get it out or have it removed. Last updated {LEGAL_UPDATED}.
        </>
      }
    >
      <Prose>
        <section>
          <h2>The short version</h2>
          <ul>
            <li>We store your email address and what your colonies' adapters report. Nothing from your save files.</li>
            <li>No ads, no analytics, no tracking, and nothing is sold or shared for marketing.</li>
            <li>Nothing about you or your colonies is public unless you switch that on yourself.</li>
            <li>You can download everything and delete your account yourself, at any time.</li>
          </ul>
        </section>

        <section>
          <h2>Who is responsible</h2>
          <p>
            smartbeavers is a fan-made tool run by {OPERATOR.name || "a private individual"}
            {OPERATOR.address && <>, {OPERATOR.address}</>}. That person is the "controller" of your data under the EU
            General Data Protection Regulation (GDPR). For anything about your data, write to {mail}.
          </p>
        </section>

        <section>
          <h2>What we store</h2>
          <ul>
            <li>
              <strong>Your account:</strong> your email address, your password stored only as a one-way hash (it can't be
              turned back into the password), an account id, and when you created the account and last signed in. If you choose to add them, a handle and a profile picture. The picture is shrunk in your
              browser first, which also removes details stored inside the file, such as where a photo was taken.
              Only you can see it, unless you make your profile public.
            </li>
            <li>
              <strong>Your colonies:</strong> the name you give each one, its faction, the game address you set, and the
              secret links your adapters call.
            </li>
            <li>
              <strong>Signals:</strong> the name of each HTTP Adapter that calls your links, whether it switched on or
              off, and when. Adapter names are whatever you type in the game, so don't put personal details in them.
            </li>
            <li>
              <strong>Trackers:</strong> which trackers you set up, and the game date you enter for the game clock.
            </li>
            <li>
              <strong>Technical logs:</strong> like any website, our hosting providers briefly log requests, including IP
              address, time, the address requested and the browser used. We use these only to keep the site running and
              to investigate abuse.
            </li>
          </ul>
          <p>
            Switching levers happens directly between your browser and the game on your own computer. Those commands
            never reach us.
          </p>
        </section>

        <section>
          <h2>If you make your profile public</h2>
          <p>
            Your profile is private by default. If you switch on "Public profile" on your account page, the following
            is shown on the colony ladder, a page anyone can open without signing in:
          </p>
          <ul>
            <li>your handle and profile picture;</li>
            <li>the name and faction of each of your colonies;</li>
            <li>each colony's game date, weather and population, where you track them;</li>
            <li>roughly when each colony last sent a signal.</li>
          </ul>
          <p>
            A colony is listed only while it has sent a signal in the last hour. Your email address,
            adapter links, signal history and other trackers are never shown. We do this only with your consent (GDPR
            Art. 6(1)(a)), which you can withdraw at any time by switching the setting off; your colonies then leave
            the ladder straight away. What others copied while it was public is outside our control.
          </p>
        </section>

        <section>
          <h2>Why we use it</h2>
          <ul>
            <li>
              <strong>To provide the service you signed up for</strong> (GDPR Art. 6(1)(b)): signing you in, recording
              your adapters' signals and showing them on your dashboard.
            </li>
            <li>
              <strong>To keep the service secure and working</strong> (our legitimate interest, Art. 6(1)(f)): technical
              logs and abuse prevention.
            </li>
          </ul>
          <p>We don't send you email. There is no newsletter.</p>
        </section>

        <section>
          <h2>Cookies and storage on your device</h2>
          <p>
            smartbeavers sets no cookies of its own and uses no tracking or advertising technology. When you sign in,
            your browser keeps your session in its local storage so you stay signed in. That is strictly necessary for
            the service, so there is no consent banner: there is nothing optional to consent to. Signing out removes it.
          </p>
          <p>Fonts and icons are served from our own site, not from third parties.</p>
        </section>

        <section>
          <h2>Who else handles your data</h2>
          <p>We use a small number of providers to run the site. They act on our instructions under data processing agreements.</p>
          <ul>
            <li>
              <strong>Supabase</strong> stores the database and handles sign-in. The
              database is in the EU (Frankfurt, Germany).
            </li>
            <li>
              <strong>Cloudflare</strong> serves the website and receives your adapters' calls. Its network operates
              worldwide, so requests may be handled outside the EU.
            </li>
          </ul>
          <p>
            Both are US-based companies. Where data is transferred outside the European Economic Area, it is covered by
            the EU–US Data Privacy Framework or the EU's standard contractual clauses.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <ul>
            <li>Account, handle, picture, colonies and signal history: until you remove them or delete your account.</li>
            <li>Technical logs: for a short period set by the hosting provider, typically days to a few weeks.</li>
            <li>Backups made by the database provider may hold deleted data for a short time before they expire.</li>
          </ul>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>Under the GDPR you can ask to see, correct, export, restrict or delete your data, and object to its use.</p>
          <ul>
            <li>
              <strong>Export:</strong> "Download export" on your account page gives you everything as one file. Each
              colony's settings have the same for that colony.
            </li>
            <li>
              <strong>Delete:</strong> "Delete account" on your account page removes your account, colonies, trackers and
              signal history. You can also delete a single colony in its settings.
            </li>
            <li>
              <strong>Correct:</strong> colony names and settings can be edited in the app. To change your email address,
              write to us.
            </li>
          </ul>
          <p>
            For anything else, write to {mail}. We answer within one month. You also have the right to complain to the
            data protection authority where you live
            {OPERATOR.authority && (
              <>
                , or to {OPERATOR.authority}
                {OPERATOR.country && <>, since smartbeavers is run from {OPERATOR.country}</>}
              </>
            )}
            .
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            smartbeavers is not aimed at children under 16. If you are younger, please use it only with a parent's or
            guardian's agreement.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            If this policy changes in a way that matters, we'll say so on the site before it takes effect. The date at
            the top shows the latest version.
          </p>
        </section>
      </Prose>
    </PublicPage>
  );
}
