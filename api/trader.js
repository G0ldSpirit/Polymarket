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

    // Récupérer les positions
    const posRes = await fetch(`https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`);
    if (!posRes.ok) {
      return res.status(500).json({ error: 'Erreur API Polymarket' });
    }
    
    const positions = await posRes.json();
    if (!positions || positions.length === 0) {
      return res.status(404).json({ error: 'Aucune position trouvée' });
    }

    // Calculer stats - VERSION CORRIGÉE
    let total = positions.length;
    let closed = 0;
    let active = 0;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalVolume = 0;

    positions.forEach(p => {
      const size = parseFloat(p.size || 0);
      const initial = parseFloat(p.initial || 0);
      const current = parseFloat(p.current || 0);
      const cashPnl = parseFloat(p.cashPnl || 0);
      const percentPnl = parseFloat(p.percentPnl || 0);
      
      // Volume = valeur initiale de toutes les positions
      totalVolume += initial;
      
      // Position fermée si size = 0
      if (size === 0 || size < 0.01) {
        closed++;
        totalProfit += cashPnl;
        
        if (cashPnl > 0) {
          wins++;
        } else if (cashPnl < 0) {
          losses++;
        }
      } else {
        // Position active
        active++;
      }
    });

    const winRate = closed > 0 ? ((wins / closed) * 100).toFixed(1) : '0';
    const avgProfit = closed > 0 ? (totalProfit / closed).toFixed(2) : '0';

    return res.status(200).json({
      username,
      address: userAddress,
      totalPositions: total,
      closedPositions: closed,
      activePositions: active,
      wins,
      losses,
      winRate,
      totalProfit: totalProfit.toFixed(2),
      avgProfit,
      totalVolume: totalVolume.toFixed(2)
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
