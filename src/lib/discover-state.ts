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
