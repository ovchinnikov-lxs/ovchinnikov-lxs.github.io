import { Resume } from '@/components/Resume';
import { ScratchReveal } from '@/components/ScratchReveal';
import { certificates, contacts, education, experience, profile, seo, SITE_URL, skills } from '@/content';

const personId = `${SITE_URL}/#person`;

// ProfilePage + Person: what Google uses for profile rich results and the knowledge panel.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: profile.name,
      inLanguage: 'en',
      publisher: { '@id': personId },
    },
    {
      '@type': 'ProfilePage',
      '@id': `${SITE_URL}/#profile`,
      url: `${SITE_URL}/`,
      name: seo.title,
      description: seo.description,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: { '@id': personId },
      primaryImageOfPage: `${SITE_URL}/opengraph-image.png`,
      dateModified: new Date().toISOString(),
    },
    {
      '@type': 'Person',
      '@id': personId,
      name: profile.name,
      alternateName: seo.alternateNames,
      givenName: 'Aleksandr',
      familyName: 'Ovchinnikov',
      jobTitle: profile.title,
      description: profile.summary,
      url: `${SITE_URL}/`,
      image: { '@type': 'ImageObject', url: `${SITE_URL}/avatar.webp`, width: 300, height: 297 },
      email: 'mailto:ovchinnikov.lxs@gmail.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Oeiras', addressRegion: 'Lisbon', addressCountry: 'PT' },
      worksFor: { '@type': 'Organization', name: experience[0].company, url: experience[0].href },
      alumniOf: { '@type': 'CollegeOrUniversity', name: education.school },
      hasCredential: certificates.map((c) => ({
        '@type': 'EducationalOccupationalCredential',
        name: c.label,
        url: c.href,
      })),
      hasOccupation: {
        '@type': 'Occupation',
        name: profile.title,
        occupationLocation: { '@type': 'Country', name: 'Portugal' },
        skills: skills.flatMap((s) => s.items.split(', ')).join(', '),
      },
      knowsAbout: ['Frontend architecture', 'Vue.js', 'Nuxt', 'Angular', 'React', 'Next.js', 'TypeScript', 'Web performance', 'CI/CD'],
      sameAs: contacts.filter((c) => c.href.startsWith('http')).map((c) => c.href),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ScratchReveal raw={<Resume skin="raw" />} ink={<Resume skin="ink" />} />
    </>
  );
}
