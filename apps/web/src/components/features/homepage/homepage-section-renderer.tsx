'use client';

import type { HomepageSection } from '@/lib/api/homepage';
import { HomepageBannerCarousel } from './homepage-banner-carousel';
import { HomepageCatalogHighlights } from './homepage-catalog-highlights';
import { HomepageDealsOfDay } from './homepage-deals-of-day';
import { HomepageFeaturedCoupons } from './homepage-featured-coupons';

interface HomepageSectionRendererProps {
  section: HomepageSection;
}

export function HomepageSectionRenderer({ section }: HomepageSectionRendererProps) {
  switch (section.type) {
    case 'BANNER_CAROUSEL':
      return <HomepageBannerCarousel items={section.items} />;

    case 'CATALOG_HIGHLIGHTS':
      return (
        <HomepageCatalogHighlights
          title={section.title}
          items={section.items}
        />
      );

    case 'DEALS_OF_DAY':
      return (
        <HomepageDealsOfDay
          title={section.title}
          items={section.items}
        />
      );

    case 'FEATURED_COUPONS':
      return (
        <HomepageFeaturedCoupons
          title={section.title}
          items={section.items}
        />
      );

    default:
      return null;
  }
}
