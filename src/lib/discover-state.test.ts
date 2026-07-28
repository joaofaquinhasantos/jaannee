import { describe, expect, it } from "vitest";
import {
  discoverRows,
  hasActiveDiscoverFilters,
  shouldShowCategoryGallery,
} from "@/lib/discover-state";

describe("Discover empty-state selection", () => {
  it("shows the category gallery only before a filter is selected", () => {
    expect(shouldShowCategoryGallery({}, 3)).toBe(true);
    expect(shouldShowCategoryGallery({ categorySlug: "khao-soi" }, 3)).toBe(false);
    expect(shouldShowCategoryGallery({ areaSlug: "ari" }, 3)).toBe(false);
  });

  it("treats either category or area as an active filter", () => {
    expect(hasActiveDiscoverFilters({})).toBe(false);
    expect(hasActiveDiscoverFilters({ categorySlug: "pad-kra-pao" })).toBe(true);
    expect(hasActiveDiscoverFilters({ areaSlug: "silom" })).toBe(true);
  });

  it("does not show an empty category gallery", () => {
    expect(shouldShowCategoryGallery({}, 0)).toBe(false);
  });

  it("uses an empty list while a filtered query is still loading", () => {
    expect(discoverRows(true, undefined, [{ id: "bootstrap" }])).toEqual([]);
    expect(discoverRows(true, [{ id: "filtered" }], [{ id: "bootstrap" }])).toEqual([
      { id: "filtered" },
    ]);
  });
});
