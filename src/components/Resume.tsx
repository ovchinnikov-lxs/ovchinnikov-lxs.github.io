import Image from 'next/image';
import {
  certificates,
  contacts,
  CV_URL,
  education,
  experience,
  highlights,
  OPEN_TO_WORK,
  profile,
  skills,
} from '@/content';

export type Skin = 'raw' | 'ink';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

function Chips({ items, small }: { items: string[]; small?: boolean }) {
  return (
    <ul className={small ? 'chips chips-sm' : 'chips'}>
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The whole page content. Rendered twice — once per skin — with identical
 * markup, so both layers share one geometry. Skins may only change paint
 * (colors, backgrounds, decorations), never box sizes: see globals.css.
 */
export function Resume({ skin }: { skin: Skin }) {
  // Only the real (raw) layer carries ids, so anchors and a11y stay unique.
  const id = (name: string) => (skin === 'raw' ? name : undefined);

  return (
    <div className="doc" data-skin={skin}>
      <header className="hero">
        <Image
          className="avatar"
          src="/avatar.webp"
          width={72}
          height={72}
          alt={skin === 'raw' ? `${profile.name}, ${profile.title}` : ''}
          priority
        />
        <p className="eyebrow">
          {profile.title} · {profile.stack}
        </p>
        <h1>{profile.name}</h1>
        <ul className="chips">
          {OPEN_TO_WORK && (
            <li className="chip chip-status">
              <span className="dot" aria-hidden="true" />
              Open to new opportunities
            </li>
          )}
          {highlights.map((h) => (
            <li key={h} className="chip">
              {h}
            </li>
          ))}
        </ul>
        <p className="actions">
          <a className="btn btn-primary" href={CV_URL} data-umami-event="open_cv" {...external}>
            Open CV ↗
          </a>
          {contacts.map((c) => (
            <a
              key={c.href}
              className="btn"
              href={c.href}
              data-umami-event={`click_${c.href.startsWith('mailto:') ? 'email' : c.label.toLowerCase()}`}
              {...(c.href.startsWith('http') && external)}
            >
              {c.href.startsWith('mailto:') ? 'Email' : c.label}
            </a>
          ))}
        </p>
      </header>

      <section className="card" aria-labelledby={id('about')}>
        <h2 className="card-label" id={id('about')}>
          <span className="num">01</span> About
        </h2>
        <p className="lead">{profile.summary}</p>
      </section>

      <section className="card" aria-labelledby={id('experience')}>
        <h2 className="card-label" id={id('experience')}>
          <span className="num">02</span> Experience
        </h2>
        {experience.map((job) => (
          <article key={job.company} className="job">
            <div className="job-head">
              <h3>
                <a href={job.href} data-umami-event="click_company" data-umami-event-company={job.company} {...external}>
                  {job.company}
                </a>
              </h3>
              <span className="period">{job.period}</span>
            </div>
            <p className="job-title">
              {job.title} <span className="place">· {job.place}</span>
            </p>
            <ul className="points">
              {job.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Chips items={job.stack} small />
          </article>
        ))}
      </section>

      <section className="card" aria-labelledby={id('skills')}>
        <h2 className="card-label" id={id('skills')}>
          <span className="num">03</span> Skills
        </h2>
        <dl className="skills">
          {skills.map((s) => (
            <div key={s.group}>
              <dt>{s.group}</dt>
              <dd>
                <Chips items={s.items.split(', ')} small />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card" aria-labelledby={id('education')}>
        <h2 className="card-label" id={id('education')}>
          <span className="num">04</span> Education
        </h2>
        <div className="edu">
          <div>
            <h3>{education.school}</h3>
            <p className="job-title">{education.field}</p>
            <p className="period">{education.period}</p>
          </div>
          <ul className="certs">
            {certificates.map((c) => (
              <li key={c.href}>
                <a href={c.href} data-umami-event="click_certificate" {...external}>
                  {c.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="foot">
        <span>
          © {new Date().getFullYear()} {profile.name}
        </span>
        <a href="https://github.com/ovchinnikov-lxs/ovchinnikov-lxs.github.io" {...external}>
          Next.js + Tailwind · source ↗
        </a>
      </footer>
    </div>
  );
}
