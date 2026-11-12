import { ArrowUpRight } from "lucide-react";
import { PublicPage } from "@/components/PublicPage";
import { OPERATOR } from "@/shared/site";

// An entry without a value isn't shown.
const CONTACTS = [
  {
    label: "Email",
    value: OPERATOR.email,
    href: OPERATOR.email && `mailto:${OPERATOR.email}`,
    note: "Best for questions about your account or your data.",
  },
  {
    label: "GitHub",
    value: OPERATOR.github,
    href: OPERATOR.github && `https://github.com/${OPERATOR.github}`,
    note: "Bug reports and ideas are welcome here.",
  },
  {
    label: "LinkedIn",
    value: OPERATOR.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
    href: OPERATOR.linkedin,
    note: "For anything professional.",
  },
].filter((c) => c.href);

export function Contact() {
  return (
    <PublicPage
      title="Contact"
      intro={
        <>
          smartbeavers is made and run by {OPERATOR.name || "one person"}. If something is broken, confusing or missing,
          I'd like to hear about it.
        </>
      }
    >
      <ul className="mt-10 max-w-2xl divide-y rounded-2xl border bg-paper">
        {CONTACTS.map((c) => (
          <li key={c.label}>
            <a
              href={c.href}
              {...(c.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" })}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cobalt-soft/30"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink-soft">{c.label}</span>
                <span className="mt-0.5 block text-lg font-semibold break-all">{c.value}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{c.note}</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}
