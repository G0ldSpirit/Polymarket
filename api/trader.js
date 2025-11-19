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

    // Récupérer TOUTES les positions (y compris fermées)
    let allPositions = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore && offset < 5000) {
      const posRes = await fetch(
        `https://data-api.polymarket.com/positions?user=${userAddress}&limit=${limit}&offset=${offset}`
      );
      
      if (!posRes.ok) break;
      
      const positions = await posRes.json();
      
      if (!positions || positions.length === 0) {
        hasMore = false;
        break;
      }
      
      allPositions.push(...positions);
      offset += limit;
      
      if (positions.length < limit) {
        hasMore = false;
      }
    }

    if (!allPositions || allPositions.length === 0) {
      return res.status(404).json({ error: 'Aucune position trouvée' });
    }

    // Calculer les stats à partir des positions
    let totalPositions = allPositions.length;
    let activePositions = 0;
    let closedPositions = 0;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalVolume = 0;
    let currentValue = 0;

    allPositions.forEach(p => {
      const size = parseFloat(p.size || 0);
      const initialValue = parseFloat(p.initialValue || p.initial || 0);
      const cashPnl = parseFloat(p.cashPnl || 0);
      const currentVal = parseFloat(p.currentValue || p.current || 0);
      
      // Volume = somme de toutes les valeurs initiales
      totalVolume += initialValue;
      
      // Position active si size > 0
      if (size > 0.01) {
        activePositions++;
        currentValue += currentVal;
      } else {
        // Position fermée
        closedPositions++;
        totalProfit += cashPnl;
        
        if (cashPnl > 0) {
          wins++;
        } else if (cashPnl < 0) {
          losses++;
        }
      }
    });

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
      currentValue: currentValue.toFixed(2)
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
