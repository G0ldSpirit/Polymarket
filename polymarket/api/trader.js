export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  try {
    let userAddress = username;

    // Si ce n'est pas une adresse, récupérer l'adresse depuis le profil
    if (!username.startsWith('0x')) {
      try {
        const profileResponse = await fetch(`https://gamma-api.polymarket.com/users/${username}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          userAddress = profileData.id || profileData.address;
        } else {
          return res.status(404).json({ error: 'Trader non trouvé' });
        }
      } catch (err) {
        return res.status(404).json({ error: 'Trader non trouvé' });
      }
    }

    // Récupérer les positions
    const positionsResponse = await fetch(`https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`);
    
    if (!positionsResponse.ok) {
      return res.status(404).json({ error: 'Impossible de récupérer les positions' });
    }

    const positions = await positionsResponse.json();

    if (!positions || positions.length === 0) {
      return res.status(404).json({ error: 'Aucune position trouvée' });
    }

    // Calculer les statistiques
    let totalPositions = positions.length;
    let closedPositions = 0;
    let wins = 0;
    let totalProfit = 0;
    let totalVolume = 0;

    positions.forEach(position => {
      const size = parseFloat(position.size || 0);
      const initialValue = parseFloat(position.initial || 0);
      const cashPnl = parseFloat(position.cashPnl || 0);
      
      totalVolume += initialValue;

      if (size === 0) {
        closedPositions++;
        totalProfit += cashPnl;
        if (cashPnl > 0) wins++;
      }
    });

    const winRate = closedPositions > 0 ? ((wins / closedPositions) * 100).toFixed(1) : 0;
    const avgProfit = closedPositions > 0 ? (totalProfit / closedPositions).toFixed(2) : 0;

    res.status(200).json({
      username,
      address: userAddress,
      totalPositions,
      closedPositions,
      activePositions: totalPositions - closedPositions,
      wins,
      losses: closedPositions - wins,
      winRate,
      totalProfit: totalProfit.toFixed(2),
      avgProfit,
      totalVolume: totalVolume.toFixed(2)
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
