// Single source of truth for the page. Mirrors the CV (Google Docs) — keep both in sync.

export const SITE_URL = 'https://ovchinnikov-lxs.github.io';

export const CV_URL =
  'https://docs.google.com/document/d/1JC52-Ez0q8nzUQ4QkAfsGF9dB3anpScE/edit?usp=sharing&ouid=102165632730673724786&rtpof=true&sd=true';

/** Flip to false to hide the "open to opportunities" badge. */
export const OPEN_TO_WORK = true;

export const seo = {
  title: 'Aleksandr Ovchinnikov — Frontend Engineer (Vue, Nuxt, Angular, React)',
  description:
    'Aleksandr Ovchinnikov — Frontend Engineer with 6+ years building production web apps with Vue/Nuxt, Angular, React/Next.js and TypeScript. Frontend architecture, performance, CI/CD, multi-brand systems. Based in Lisbon, Portugal — open to new opportunities.',
  keywords: [
    'Aleksandr Ovchinnikov',
    'Alexander Ovchinnikov',
    'Александр Овчинников',
    'ovchinnikov-lxs',
    'Frontend Engineer',
    'Frontend Developer',
    'Senior Frontend Developer',
    'Vue.js developer',
    'Nuxt developer',
    'Angular developer',
    'React developer',
    'Next.js developer',
    'TypeScript',
    'Frontend architecture',
    'Web performance',
    'Lisbon',
    'Portugal',
    'Portfolio',
    'CV',
  ],
  alternateNames: ['Alexander Ovchinnikov', 'Александр Овчинников', 'ovchinnikov-lxs'],
};

export type Link = { label: string; href: string };

export type Job = {
  company: string;
  href: string;
  title: string;
  place: string;
  period: string;
  points: string[];
  stack: string[];
};

export const profile = {
  name: 'Aleksandr Ovchinnikov',
  title: 'Frontend Engineer',
  stack: 'Vue / Nuxt · Angular · React / Next · TypeScript',
  location: 'Oeiras (Lisbon area), Portugal',
  workAuth: 'Portugal residence permit (highly qualified activity) — no relocation needed',
  summary:
    'Frontend Engineer with 6+ years of experience building production web applications with Vue/Nuxt, Angular, and TypeScript. Strong background in frontend architecture, performance optimization, CI/CD, and scalable multi-brand systems. I use AI-assisted workflows as a force multiplier, not a replacement for engineering judgement. Currently expanding my stack with React and Next.js through hands-on projects — this site is one of them.',
};

export const contacts: Link[] = [
  { label: 'ovchinnikov.lxs@gmail.com', href: 'mailto:ovchinnikov.lxs@gmail.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ovchinnikov-lxs' },
  { label: 'GitHub', href: 'https://github.com/ovchinnikov-lxs' },
];

export const experience: Job[] = [
  {
    company: 'BrainRocket',
    href: 'https://www.brainrocket.com/',
    title: 'Frontend Developer (Angular)',
    place: 'Georgia (remote) → Portugal (on-site)',
    period: '2025 – present',
    stack: ['Angular', 'TypeScript', 'Claude Code', 'Animations', 'Figma'],
    points: [
      'Built an AI-assisted development infrastructure around Claude Code, including custom skills, project rules, and structured documentation, reducing feature delivery time by up to 3× while improving code consistency and onboarding.',
      'Developed pixel-perfect, responsive interfaces with complex animations and unconventional visual concepts, translating Figma designs into production-ready UI.',
      'Refactored the shared UI system and optimized rendering performance by up to 3×, while reducing hidden UI regressions, code inconsistencies, and implementation errors.',
    ],
  },
  {
    company: 'Wintech',
    href: 'https://wintechplatform.com/',
    title: 'Frontend Engineer (Deputy Head of Frontend)',
    place: 'Remote',
    period: '2023 – 2025',
    stack: ['Nuxt 3', 'Vue', 'Nitro', 'Redis', 'Strapi', 'CI/CD'],
    points: [
      'Migrated the platform from Nuxt 2 to Nuxt 3 using Nuxt layers to support multiple visual variants and a core layer for shared business logic, enabling feature reuse across all platform projects.',
      'Improved website performance by 2.5× through hybrid rendering in Nitro with SWR caching and Redis-based page revalidation, enhancing UX and SEO for critical payloads.',
      'Redesigned CI/CD to support a single build for all brands with runtime variables per project, cutting release delivery from several hours per environment to 10 minutes.',
      'Built a custom i18n solution instead of nuxt-i18n with runtime locale-based page generation using a prefix strategy.',
      'Integrated Strapi CMS for project customization configs and built a tool converting Tokens Studio JSON into CSS variables with per-locale theming.',
      'Temporarily acted as Head of Frontend: planned work with managers and other department heads, reported to the CTO, hired a team member, found a new Head of Frontend, and set up review and release processes.',
      'Onboarded 3 colleagues with SMART probation goals, enabling the team to deliver a large number of projects in a short time.',
    ],
  },
  {
    company: 'IdaLite',
    href: 'https://idalite.ru/',
    title: 'Frontend Engineer',
    place: 'Moscow (hybrid)',
    period: '2020 – 2023',
    stack: ['Vue', 'Nuxt', 'TypeScript', 'Leaflet', 'Google Maps'],
    points: [
      'Developed a website builder with 500+ customizable blocks: content, color palettes, UI kits per block, and backend API integrations (real estate layouts, mortgage calculators, booking).',
      'Created an internal styleless UI library and a DX ecosystem — test libraries, linters, and CI/CD templates.',
      'Built a customer account platform integrating multiple backend APIs for authentication, profiles, bookings, and domain-specific services.',
      'Built interactive real estate maps with Leaflet and Google Maps: custom points of interest, infrastructure, routes, filtering, and map styling.',
      'Implemented PDF generation for apartment information sheets used by real estate agents.',
    ],
  },
];

export const highlights = ['6+ years', 'Oeiras · Lisbon, PT', 'PT residence permit', 'No relocation needed'];

export const skills: { group: string; items: string }[] = [
  { group: 'Frontend', items: 'TypeScript, JavaScript, Vue.js, Nuxt.js, React, Next.js, Angular, Pinia, HTML, CSS/SCSS, Tailwind CSS' },
  { group: 'Backend', items: 'Node.js, NestJS, Nitro, REST APIs, PostgreSQL, Redis, Strapi' },
  {
    group: 'Architecture & performance',
    items: 'SSR, SSG, SWR, caching, multi-brand architecture, i18n, PWA, profiling, RUM, Lighthouse, WebPageTest',
  },
  { group: 'AI-assisted workflows', items: 'Claude Code, code generation, refactoring, testing, documentation, code review' },
  { group: 'Testing', items: 'Vitest, Cypress' },
  { group: 'Delivery', items: 'Git, GitHub, GitLab, CI/CD, Vite, Webpack, Storybook' },
  { group: 'Engineering', items: 'Code review, mentoring, team leadership, architecture planning' },
];

export const education = {
  school: 'A.A. Leonov State Technical University, Korolev',
  field: 'Control and Informatics in Technical Systems',
  period: '2017 – 2020 · completed 3 years',
};

export const certificates: Link[] = [
  {
    label: 'Front End Development Libraries (React) — freeCodeCamp',
    href: 'https://www.freecodecamp.org/certification/fcc-93404d0a-6952-4cf2-905d-84eb9dde8147/front-end-development-libraries-v9',
  },
  {
    label: 'Responsive Web Design — freeCodeCamp',
    href: 'https://www.freecodecamp.org/certification/fcc-93404d0a-6952-4cf2-905d-84eb9dde8147/responsive-web-design-v9',
  },
];
