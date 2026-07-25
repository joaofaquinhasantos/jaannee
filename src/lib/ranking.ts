// Shared public ranking threshold. A dish is publicly ranked only when
// `comparisons_count >= PUBLIC_RANK_THRESHOLD`. Keep this constant in
// one client-safe module so presentational components never import a
// server-function module just to read the number.
export const PUBLIC_RANK_THRESHOLD = 5;