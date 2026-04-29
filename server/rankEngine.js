// Rank tiers
const RANKS = [
  { name: 'Bronze', emoji: '🥉', min: 0, max: 299, color: '#cd7f32' },
  { name: 'Silver', emoji: '🥈', min: 300, max: 599, color: '#c0c0c0' },
  { name: 'Gold', emoji: '🥇', min: 600, max: 999, color: '#ffd700' },
  { name: 'Diamond', emoji: '💎', min: 1000, max: 1499, color: '#00f5ff' },
  { name: 'Champion', emoji: '👑', min: 1500, max: Infinity, color: '#ff00aa' }
];

function getRankTier(points) {
  return RANKS.find(r => points >= r.min && points <= r.max) || RANKS[0];
}

function calculatePointChange(winnerPoints, loserPoints) {
  const diff = winnerPoints - loserPoints;

  let winGain, losePenalty;

  if (diff > 200) {
    // Winner is much higher ranked
    winGain = 10;
    losePenalty = -15;
  } else if (diff > 0) {
    // Winner is slightly higher
    winGain = 15;
    losePenalty = -12;
  } else if (diff > -200) {
    // Winner is slightly lower (upset)
    winGain = 25;
    losePenalty = -8;
  } else {
    // Winner is much lower (big upset)
    winGain = 30;
    losePenalty = -5;
  }

  return { winGain, losePenalty };
}

function processMatchResult(winner, loser) {
  const { winGain, losePenalty } = calculatePointChange(winner.points, loser.points);

  return {
    winnerId: winner.id,
    loserId: loser.id,
    winnerChange: winGain,
    loserChange: losePenalty,
    winnerNewPoints: Math.max(0, winner.points + winGain),
    loserNewPoints: Math.max(0, loser.points + losePenalty),
    winnerRank: getRankTier(Math.max(0, winner.points + winGain)),
    loserRank: getRankTier(Math.max(0, loser.points + losePenalty))
  };
}

function processDrawResult(player1, player2) {
  const drawPoints = 5;
  return {
    p1Change: drawPoints,
    p2Change: drawPoints,
    p1NewPoints: player1.points + drawPoints,
    p2NewPoints: player2.points + drawPoints,
    p1Rank: getRankTier(player1.points + drawPoints),
    p2Rank: getRankTier(player2.points + drawPoints)
  };
}

module.exports = { RANKS, getRankTier, calculatePointChange, processMatchResult, processDrawResult };
