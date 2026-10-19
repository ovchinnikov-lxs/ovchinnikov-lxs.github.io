import { Resume } from '@/components/Resume';
import { ScratchReveal } from '@/components/ScratchReveal';
import { contacts, profile, SITE_URL } from '@/content';

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.name,
  jobTitle: profile.title,
  url: SITE_URL,
  email: 'mailto:ovchinnikov.lxs@gmail.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Oeiras', addressCountry: 'PT' },
  sameAs: contacts.filter((c) => c.href.startsWith('http')).map((c) => c.href),
  knowsAbout: ['Frontend architecture', 'Vue.js', 'Nuxt', 'Angular', 'React', 'Next.js', 'TypeScript', 'Web performance'],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <ScratchReveal raw={<Resume skin="raw" />} ink={<Resume skin="ink" />} />
    </>
  );
}
