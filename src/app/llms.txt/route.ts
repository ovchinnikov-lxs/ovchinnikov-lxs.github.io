import { certificates, contacts, CV_URL, education, experience, OPEN_TO_WORK, profile, seo, SITE_URL, skills } from '@/content';

export const dynamic = 'force-static';

// llms.txt (https://llmstxt.org): a plain-Markdown summary of the site for AI assistants and agents.
export function GET() {
  const lines = [
    `# ${profile.name}`,
    '',
    `> ${seo.description}`,
    '',
    `${profile.title} · ${profile.stack}. ${profile.location}. ${profile.workAuth}.${OPEN_TO_WORK ? ' Open to new opportunities.' : ''}`,
    '',
    '## Profile',
    '',
    `- [Portfolio](${SITE_URL}/): this page — summary, experience, skills, education`,
    `- [CV (Google Docs)](${CV_URL}): full résumé`,
    ...contacts.map((c) => `- [${c.href.startsWith('mailto:') ? 'Email' : c.label}](${c.href})`),
    '',
    '## About',
    '',
    profile.summary,
    '',
    '## Experience',
    '',
    ...experience.flatMap((job) => [
      `### ${job.company} — ${job.title} (${job.period}, ${job.place})`,
      '',
      `- [${job.company}](${job.href})`,
      ...job.points.map((p) => `- ${p}`),
      `- Stack: ${job.stack.join(', ')}`,
      '',
    ]),
    '## Skills',
    '',
    ...skills.map((s) => `- ${s.group}: ${s.items}`),
    '',
    '## Education',
    '',
    `- ${education.school} — ${education.field} (${education.period})`,
    '',
    '## Optional',
    '',
    ...certificates.map((c) => `- [${c.label}](${c.href})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
