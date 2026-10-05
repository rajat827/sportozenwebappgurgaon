export function spotsRemaining(game) {
  if (game.spotsLeft === null || game.spotsLeft === undefined || game.spotsLeft === '') return null;
  const spots = Number(game.spotsLeft);
  return Number.isInteger(spots) && spots >= 0 ? spots : null;
}

export function spotsLabel(game) {
  const spots = spotsRemaining(game);
  if (spots === null) return 'Check spots on WhatsApp';
  if (spots === 0) return 'Full';
  return `${spots} ${spots === 1 ? 'spot' : 'spots'} left`;
}
