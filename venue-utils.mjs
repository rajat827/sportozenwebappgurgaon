export function verifiedRating(venue) {
  const value = Number(venue.rating?.value);
  const count = Number(venue.rating?.count);
  return Number.isFinite(value) && value >= 0 && value <= 5 && Number.isInteger(count) && count > 0
    ? { value, count }
    : null;
}

export function venueOffer(venue) {
  return typeof venue.offer?.label === 'string' && venue.offer.label.trim() ? venue.offer : null;
}
