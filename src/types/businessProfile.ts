export interface BusinessProfile {
  // Company half — canonical fields
  companyName?: string;
  industry?: string;
  website?: string;
  valueProposition?: string;
  productsServices?: string;
  targetCustomers?: string;
  contactEmail?: string;
  contactPhone?: string;
  personaName?: string;
  personaTitle?: string;
  bookingLink?: string;

  // ICP half — canonical fields
  companyDescription?: string;
  icpJobTitles?: string;
  icpCompanySize?: string;
  icpCompanySizeFrom?: string;
  icpCompanySizeTo?: string;
  icpDomainNiche?: string;
  icpLocations?: string;
  icpPainPoints?: string;
  icpDecisionDrivers?: string;
  icpTriggers?: string;
  sampleConversation?: string;
  operatingHours?: string;
  timezone?: string;
  geographicFocus?: string;
  competitors?: string;
  campaignTone?: string;
  toneAndVoice?: string;
  styleGuide?: string;
  dosAndDonts?: string;
  valueStatement?: string;
  caseStories?: string;
  compliantGuarantee?: string;

  // Company basics
  companyLocation?: string;
  companyLogoUrl?: string;

  // Offer (B2B)
  icpSegments?: string;
  costOfInaction?: string;
  discoveryQuestions?: string;
  deliveryProcess?: string;
  proofPoints?: string;
  notAGoodFit?: string;
  commonObjections?: string;
  differentiators?: string;
  guarantee?: string;
  uniqueExperience?: string;
  socialCredentials?: string;
  twelveMonthMetrics?: string;
  averageLifecycle?: string;
  revenueResults?: string;
  averageDealSize?: string;
  salesCycleTime?: string;
  idealBuyerCriteria?: string;

  [extraKey: string]: unknown;
}

export interface BusinessProfileCompleteness {
  filled: number;
  total: number;
  pct: number;
}

export const CANONICAL_REQUIRED_KEYS = [
  'companyName',
  'industry',
  'valueProposition',
  'productsServices',
  'targetCustomers',
  'companyDescription',
  'icpJobTitles',
  'icpDomainNiche',
  'icpLocations',
  'icpPainPoints',
  'icpDecisionDrivers',
  'icpTriggers',
  'icpCompanySizeFrom',
  'icpCompanySizeTo',
] as const;

export const OFFER_KEYS = [
  'uniqueExperience',
  'socialCredentials',
  'twelveMonthMetrics',
  'averageLifecycle',
  'revenueResults',
  'averageDealSize',
  'salesCycleTime',
  'idealBuyerCriteria',
  'commonObjections',
] as const;

export function computeProfileCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const total = 14;
  if (!profile) return { filled: 0, total, pct: 0 };
  
  let filled = 0;
  for (const key of CANONICAL_REQUIRED_KEYS) {
    const val = profile[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      filled += 1;
    }
  }
  
  const pct = Math.round((filled / total) * 100);
  return { filled, total, pct };
}

export function computeOfferCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const total = OFFER_KEYS.length;
  if (!profile) return { filled: 0, total, pct: 0 };

  let filled = 0;
  for (const key of OFFER_KEYS) {
    const val = profile[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      filled += 1;
    }
  }

  const pct = Math.round((filled / total) * 100);
  return { filled, total, pct };
}
