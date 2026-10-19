import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
      images: [`${SITE_URL}/avatar.webp`, `${SITE_URL}/opengraph-image.png`],
    },
  ];
}
