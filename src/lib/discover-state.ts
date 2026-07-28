export type DiscoverFilters = {
  categorySlug?: string;
  areaSlug?: string;
};

export function hasActiveDiscoverFilters(filters: DiscoverFilters): boolean {
  return Boolean(filters.categorySlug || filters.areaSlug);
}

export function shouldShowCategoryGallery(
  filters: DiscoverFilters,
  referencePhotoCount: number,
): boolean {
  return !hasActiveDiscoverFilters(filters) && referencePhotoCount > 0;
}

/** Keep filter transitions render-safe while React Query has no data yet. */
export function discoverRows<T>(
  hasFilters: boolean,
  filteredRows: T[] | undefined,
  bootstrapRows: T[] | undefined,
): T[] {
  return hasFilters ? (filteredRows ?? []) : (bootstrapRows ?? []);
}
