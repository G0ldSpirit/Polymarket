// Vercel Serverless Function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get username from query
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required' });
  }

  try {
    let userAddress = username;
    let displayName = username;

    // If not an address, resolve username to address
    if (!username.startsWith('0x')) {
      try {
        const profileUrl = `https://gamma-api.polymarket.com/users/${username}`;
        const profileResponse = await fetch(profileUrl);
        
        if (!profileResponse.ok) {
          return res.status(404).json({ error: 'Trader non trouvé. Vérifiez le pseudo.' });
        }

        const profileData = await profileResponse.json();
        userAddress = profileData.id || profileData.address;
        
        if (!userAddress) {
          return res.status(404).json({ error: 'Impossible de récupérer l\'adresse du trader' });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        return res.status(404).json({ error: 'Trader non trouvé. Vérifiez le pseudo.' });
      }
    }

    // Fetch positions from Polymarket Data API
    const positionsUrl = `https://data-api.polymarket.com/positions?user=${userAddress}&limit=500`;
    const positionsResponse = await fetch(positionsUrl);
    
    if (!positionsResponse.ok) {
      return res.status(500).json({ error: 'Impossible de récupérer les positions' });
    }

    const positions = await positionsResponse.json();

    if (!positions || positions.length === 0) {
      return res.status(404).json({ error: 'Aucune position trouvée pour ce trader' });
    }

    // Calculate statistics
    let totalPositions = positions.length;
    let closedPositions = 0;
    let activePositions = 0;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalVolume = 0;

    positions.forEach(position => {
      const size = parseFloat(position.size || 0);
      const initialValue = parseFloat(position.initial || 0);
      const cashPnl = parseFloat(position.cashPnl || 0);
      
      totalVolume += initialValue;

      // Active position if size > 0
      if (size > 0) {
        activePositions++;
      } else {
        // Closed position
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

    // Return statistics
    return res.status(200).json({
      username: displayName,
      address: userAddress,
      totalPositions,
      closedPositions,
      activePositions,
      wins,
      losses,
      winRate,
      totalProfit: totalProfit.toFixed(2),
      avgProfit,
      totalVolume: totalVolume.toFixed(2)
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
}
