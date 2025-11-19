export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, debug } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username requis' });
  }

  try {
    let userAddress = username;

    // Résoudre le pseudo vers l'adresse
    if (!username.startsWith('0x')) {
      const profileRes = await fetch(`https://gamma-api.polymarket.com/users/${username}`);
      if (!profileRes.ok) {
        return res.status(404).json({ error: 'Trader non trouvé' });
      }
      const profile = await profileRes.json();
      userAddress = profile.id || profile.address;
    }

    // MODE DEBUG - retourner quelques trades bruts
    if (debug === 'activity') {
      const activityRes = await fetch(
        `https://data-api.polymarket.com/activity?user=${userAddress}&type=TRADE&limit=5`
      );
      
      if (!activityRes.ok) {
        return res.status(500).json({ error: 'Erreur API activity' });
      }
      
      const activities = await activityRes.json();
      
      return res.status(200).json({
        sampleTrades: activities,
        total: activities.length
      });
    }

    // Récupérer les positions actuelles
    const posRes = await fetch(`https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`);
    if (!posRes.ok) {
      return res.status(500).json({ error: 'Erreur API Polymarket' });
    }
    
    const positions = await posRes.json();

    // Récupérer l'historique des trades
    const activityRes = await fetch(
      `https://data-api.polymarket.com/activity?user=${userAddress}&type=TRADE&limit=500`
    );
    
    let allTrades = [];
    if (activityRes.ok) {
      allTrades = await activityRes.json();
    }

    // Calculer les stats à partir des positions actuelles
    let totalPositions = positions ? positions.length : 0;
    let activePositions = 0;
    let closedPositions = 0;

    if (positions) {
      positions.forEach(p => {
        const size = parseFloat(p.size || 0);
        if (size > 0) {
          activePositions++;
        }
      });
    }

    // Calculer les stats à partir de l'historique des trades
    let totalVolume = 0;
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;

    // Regrouper les trades par market
    const marketTrades = {};

    allTrades.forEach(trade => {
      const market = trade.market || trade.marketId || trade.conditionId;
      const side = trade.side; // BUY ou SELL
      const cash = Math.abs(parseFloat(trade.cash || 0));
      const tokens = Math.abs(parseFloat(trade.tokens || 0));
      
      // Ajouter au volume total
      totalVolume += cash;
      
      if (!marketTrades[market]) {
        marketTrades[market] = { buyValue: 0, sellValue: 0 };
      }
      
      if (side === 'BUY') {
        marketTrades[market].buyValue += cash;
      } else if (side === 'SELL') {
        marketTrades[market].sellValue += cash;
      }
    });

    // Calculer le P&L pour chaque marché
    Object.keys(marketTrades).forEach(market => {
      const { buyValue, sellValue } = marketTrades[market];
      const pnl = sellValue - buyValue;
      
      totalProfit += pnl;
      
      if (pnl > 0) {
        wins++;
      } else if (pnl < 0) {
        losses++;
      }
    });

    closedPositions = wins + losses;
    const winRate = closedPositions > 0 ? ((wins / closedPositions) * 100).toFixed(1) : '0';
    const avgProfit = closedPositions > 0 ? (totalProfit / closedPositions).toFixed(2) : '0';

    return res.status(200).json({
      username,
      address: userAddress,
      totalPositions: closedPositions + activePositions,
      closedPositions,
      activePositions,
      wins,
      losses,
      winRate,
      totalProfit: totalProfit.toFixed(2),
      avgProfit,
      totalVolume: totalVolume.toFixed(2),
      totalTrades: allTrades.length
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
