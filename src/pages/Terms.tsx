import { Link } from "react-router";
import { PublicPage, Prose } from "@/components/PublicPage";
import { LEGAL_UPDATED, OPERATOR } from "@/shared/site";

export function Terms() {
  return (
    <PublicPage
      title="Terms of use"
      intro={<>The rules for using smartbeavers, kept short. Last updated {LEGAL_UPDATED}.</>}
    >
      <Prose>
        <section>
          <h2>What this is</h2>
          <p>
            smartbeavers is a free, fan-made companion for Timberborn's HTTP Lever and HTTP Adapter buildings, run by{" "}
            {OPERATOR.name || "a private individual"}. It is not affiliated with or endorsed by Mechanistry, the studio
            behind Timberborn. By creating an account or using the site you agree to these terms.
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <ul>
            <li>You sign in with your email address. Keep access to that mailbox secure, since it is your key.</li>
            <li>
              Your colonies' adapter links are secrets. Anyone who has them can send signals to your colony, so don't
              share them. If they leak, make new ones in the colony's settings.
            </li>
            <li>You can delete your account at any time from your account page.</li>
          </ul>
        </section>

        <section>
          <h2>Fair use</h2>
          <p>Please use smartbeavers for what it's for. In particular, don't:</p>
          <ul>
            <li>send signals at a rate far beyond what a game produces, or otherwise overload the service;</li>
            <li>try to access other players' colonies or data;</li>
            <li>use it for anything unlawful, or put personal data about other people into colony or adapter names.</li>
          </ul>
          <p>We may limit, suspend or remove accounts that do, and remove data that causes problems.</p>
        </section>

        <section>
          <h2>Your content</h2>
          <p>
            The names you enter and the signals your game sends stay yours. You allow us to store and process them only
            to provide the service to you, as described in the <Link to="/privacy">privacy policy</Link>.
          </p>
        </section>

        <section>
          <h2>No guarantees</h2>
          <p>
            smartbeavers is a hobby project provided as it is, free of charge. It may be unavailable, lose signals,
            change or shut down, and we can't promise otherwise. Don't rely on it for anything that matters beyond your
            game. If the service is going to close, we'll give notice on the site so you can export your data first.
          </p>
        </section>

        <section>
          <h2>Liability</h2>
          <p>
            To the extent the law allows, we are not liable for losses arising from using or being unable to use the
            service. Nothing in these terms limits liability that cannot be limited by law, such as for intent or gross
            negligence, or takes away rights you have as a consumer.
          </p>
        </section>

        <section>
          <h2>Changes to these terms</h2>
          <p>
            We may update these terms. If a change matters, we'll say so on the site before it takes effect. Continuing
            to use smartbeavers after that means you accept the new terms.
          </p>
        </section>

        {OPERATOR.country && (
          <section>
            <h2>Governing law</h2>
            <p>
              These terms are governed by the law of {OPERATOR.country}. If you are a consumer, the mandatory consumer
              protection rules of the country you live in still apply to you.
            </p>
          </section>
        )}

        <section>
          <h2>Contact</h2>
          <p>
            Questions about these terms? See the <Link to="/contact">contact page</Link>.
          </p>
        </section>
      </Prose>
    </PublicPage>
  );
}
