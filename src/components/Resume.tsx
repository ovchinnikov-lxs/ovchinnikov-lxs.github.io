import {
  certificates,
  contacts,
  CV_URL,
  education,
  experience,
  OPEN_TO_WORK,
  profile,
  skills,
} from '@/content';

export type Skin = 'raw' | 'ink';

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
      <header>
        <h1>{profile.name}</h1>
        <p className="lead">
          <strong>{profile.title}</strong> · {profile.stack}
        </p>
        <p className="meta">
          {profile.location}
          <br />
          {profile.workAuth}
        </p>
        {OPEN_TO_WORK && (
          <p className="badge">
            <span className="dot" aria-hidden="true">
              ●
            </span>{' '}
            Open to new opportunities
          </p>
        )}
        <p className="links">
          <a href={CV_URL} target="_blank" rel="noopener noreferrer">
            CV (Google Docs) ↗
          </a>
          {contacts.map((c) => (
            <span key={c.href}>
              {' · '}
              <a
                href={c.href}
                {...(c.href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
              >
                {c.label}
              </a>
            </span>
          ))}
        </p>
        <p className="hint">
          <small>
            This is plain HTML. There is a design underneath — scratch it with the cursor, or scroll with a finger on
            touch screens.
          </small>
        </p>
      </header>

      <hr />

      <section aria-labelledby={id('about')}>
        <h2 id={id('about')}>About</h2>
        <p>{profile.summary}</p>
      </section>

      <section aria-labelledby={id('experience')}>
        <h2 id={id('experience')}>Experience</h2>
        {experience.map((job) => (
          <article key={job.company} className="job">
            <h3>
              <a href={job.href} target="_blank" rel="noopener noreferrer">
                {job.company}
              </a>{' '}
              — {job.title}
            </h3>
            <p className="meta">
              <em>
                {job.period} · {job.place}
              </em>
            </p>
            <ul>
              {job.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section aria-labelledby={id('skills')}>
        <h2 id={id('skills')}>Skills</h2>
        <dl>
          {skills.map((s) => (
            <div key={s.group}>
              <dt>{s.group}</dt>
              <dd>{s.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={id('education')}>
        <h2 id={id('education')}>Education</h2>
        <p>
          <strong>{education.school}</strong>
          <br />
          {education.field}
          <br />
          <em className="meta">{education.period}</em>
        </p>
        <h3>Certificates</h3>
        <ul>
          {certificates.map((c) => (
            <li key={c.href}>
              <a href={c.href} target="_blank" rel="noopener noreferrer">
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <hr />

      <footer>
        <p>
          <small>
            © {new Date().getFullYear()} {profile.name} · Built with Next.js + Tailwind ·{' '}
            <a href="https://github.com/ovchinnikov-lxs/ovchinnikov-lxs.github.io" target="_blank" rel="noopener noreferrer">
              source
            </a>
          </small>
        </p>
      </footer>
    </div>
  );
}
