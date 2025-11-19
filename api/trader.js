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

    // 1. Récupérer les positions actuelles
    const posRes = await fetch(`https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`);
    const positions = posRes.ok ? await posRes.json() : [];

    // 2. Récupérer TOUS les trades pour reconstituer l'historique
    let allTrades = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;
    let maxPages = 100;

    while (hasMore && maxPages > 0) {
      try {
        const activityRes = await fetch(
          `https://data-api.polymarket.com/activity?user=${userAddress}&type=TRADE&limit=${limit}&offset=${offset}`,
          { signal: AbortSignal.timeout(5000) }
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
        
        if (activities.length < limit) {
          hasMore = false;
        }
      } catch (err) {
        console.error(`Error at offset ${offset}:`, err);
        break;
      }
    }

    // 3. Analyser les positions actuelles
    let activePositions = 0;
    let currentValue = 0;

    positions.forEach(p => {
      const size = parseFloat(p.size || 0);
      if (size > 0.01) {
        activePositions++;
        currentValue += parseFloat(p.currentValue || 0);
      }
    });

    // 4. Reconstituer l'historique complet depuis les trades
    const marketData = {};
    
    allTrades.forEach(trade => {
      const market = trade.conditionId || trade.market;
      const side = trade.side;
      const usdcSize = Math.abs(parseFloat(trade.usdcSize || 0));
      
      if (!market || !side) return;
      
      if (!marketData[market]) {
        marketData[market] = {
          buyTotal: 0,
          sellTotal: 0,
          buyCount: 0,
          sellCount: 0
        };
      }
      
      if (side === 'BUY') {
        marketData[market].buyTotal += usdcSize;
        marketData[market].buyCount++;
      } else if (side === 'SELL') {
        marketData[market].sellTotal += usdcSize;
        marketData[market].sellCount++;
      }
    });

    // 5. Calculer les stats finales
    let totalVolume = 0;
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;
    let closedMarkets = 0;
    let totalMarkets = Object.keys(marketData).length;

    Object.values(marketData).forEach(market => {
      // Volume = total des achats (pour éviter de compter double)
      totalVolume += market.buyTotal;
      
      // Si le marché a des achats ET des ventes, il est considéré fermé
      if (market.buyTotal > 0 && market.sellTotal > 0) {
        closedMarkets++;
        const pnl = market.sellTotal - market.buyTotal;
        totalProfit += pnl;
        
        if (pnl > 0) {
          wins++;
        } else if (pnl < 0) {
          losses++;
        }
      }
    });

    const totalPositions = totalMarkets;
    const closedPositions = closedMarkets;
    const winRate = closedPositions > 0 ? ((wins / closedPositions) * 100).toFixed(1) : '0';
    const avgProfit = closedPositions > 0 ? (totalProfit / closedPositions).toFixed(2) : '0';

    return res.status(200).json({
      username,
      address: userAddress,
      totalPositions,
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
