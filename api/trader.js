export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username } = req.query;

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

    // Récupérer les positions actuelles
    const posRes = await fetch(`https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`);
    if (!posRes.ok) {
      return res.status(500).json({ error: 'Erreur API Polymarket' });
    }
    
    const positions = await posRes.json();

    // Récupérer TOUS les trades avec pagination complète
    let allTrades = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;
    let maxPages = 100; // Maximum 50,000 trades (100 pages * 500)

    while (hasMore && maxPages > 0) {
      try {
        const activityRes = await fetch(
          `https://data-api.polymarket.com/activity?user=${userAddress}&type=TRADE&limit=${limit}&offset=${offset}`,
          { signal: AbortSignal.timeout(5000) } // Timeout de 5 secondes par requête
        );
        
        if (!activityRes.ok) break;
        
        const activities = await activityRes.json();
        
        if (!activities || activities.length === 0) {
          hasMore = false;
          break;
        }
        
        allTrades.push(...activities);
        offset += limit;
        maxPages--;
        
        // Si on reçoit moins que la limite, c'est la dernière page
        if (activities.length < limit) {
          hasMore = false;
        }
      } catch (err) {
        console.error(`Error fetching page at offset ${offset}:`, err);
        break;
      }
    }

    // Calculer les stats à partir des positions actuelles
    let totalPositions = positions ? positions.length : 0;
    let activePositions = 0;

    if (positions) {
      positions.forEach(p => {
        const size = parseFloat(p.size || 0);
        if (size > 0.01) {
          activePositions++;
        }
      });
    }

    // Calculer les stats à partir de l'historique des trades
    let totalVolume = 0;
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;

    // Regrouper les trades par market (conditionId)
    const marketTrades = {};

    allTrades.forEach(trade => {
      const market = trade.conditionId || trade.market;
      const side = trade.side; // BUY ou SELL
      const usdcSize = Math.abs(parseFloat(trade.usdcSize || 0));
      
      // Ajouter au volume total
      totalVolume += usdcSize;
      
      if (!market) return;
      
      if (!marketTrades[market]) {
        marketTrades[market] = { buyValue: 0, sellValue: 0, trades: 0 };
      }
      
      marketTrades[market].trades++;
      
      if (side === 'BUY') {
        marketTrades[market].buyValue += usdcSize;
      } else if (side === 'SELL') {
        marketTrades[market].sellValue += usdcSize;
      }
    });

    // Calculer le P&L pour chaque marché
    let marketsWithTrades = 0;
    Object.keys(marketTrades).forEach(market => {
      const { buyValue, sellValue, trades } = marketTrades[market];
      
      // Seulement compter les marchés avec au moins 1 achat ET 1 vente
      if (buyValue > 0 && sellValue > 0) {
        marketsWithTrades++;
        const pnl = sellValue - buyValue;
        
        totalProfit += pnl;
        
        if (pnl > 0) {
          wins++;
        } else if (pnl < 0) {
          losses++;
        }
      }
    });

    const closedPositions = wins + losses;
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
