/**
 * FC Auggen Player Portrait & Avatar Generator
 * Generates authentic, high-resolution SVG portrait data URLs for all FC Auggen players & staff.
 * Designed with FC Auggen team colors: Deep Red (#C00000), Obsidian Black (#0A0E17), Gold (#F59E0B), and Emerald (#10B981).
 */

export interface PlayerAvatarOptions {
  name?: string;
  firstName?: string;
  lastName?: string;
  number?: number | string;
  position?: string;
  category?: 'player' | 'coach' | 'staff' | 'medical';
}

// Generate distinct color accents based on position and jersey
function getPositionPalette(position: string, category: string) {
  const cleanPos = (position || '').toUpperCase();
  if (category === 'coach' || category === 'staff') {
    return {
      jerseyPrimary: '#1E293B', // Trainer Dark Slate
      jerseySecondary: '#C00000',
      accent: '#38BDF8', // Cyan
      badge: 'COACH',
      badgeBg: '#0284C7',
      collar: '#334155'
    };
  }
  if (cleanPos.includes('TW') || cleanPos.includes('TOR')) {
    return {
      jerseyPrimary: '#059669', // Goalkeeper Emerald / Neon
      jerseySecondary: '#064E3B',
      accent: '#34D399',
      badge: 'TW',
      badgeBg: '#10B981',
      collar: '#047857'
    };
  }
  if (cleanPos.includes('ST') || cleanPos.includes('LF') || cleanPos.includes('RF')) {
    return {
      jerseyPrimary: '#C00000', // Striker Auggen Red
      jerseySecondary: '#18181B',
      accent: '#F59E0B',
      badge: 'ST',
      badgeBg: '#DC2626',
      collar: '#000000'
    };
  }
  if (cleanPos.includes('M') || cleanPos.includes('ZM') || cleanPos.includes('OM') || cleanPos.includes('DM')) {
    return {
      jerseyPrimary: '#18181B', // Midfield Obsidian Red Stripes
      jerseySecondary: '#C00000',
      accent: '#FBBF24',
      badge: 'MF',
      badgeBg: '#B91C1C',
      collar: '#C00000'
    };
  }
  // Defenders
  return {
    jerseyPrimary: '#C00000', // Auggen Red
    jerseySecondary: '#000000',
    accent: '#FFFFFF',
    badge: 'DEF',
    badgeBg: '#991B1B',
    collar: '#0A0E17'
  };
}

export function generatePlayerAvatar(p: PlayerAvatarOptions): string {
  const numberStr = p.number !== undefined && p.number !== null && p.number !== 0 ? String(p.number) : '';
  const lastName = (p.lastName || p.name || 'FCA').trim().toUpperCase();
  const firstName = (p.firstName || '').trim();
  const pos = (p.position || (p.category === 'coach' ? 'TRAINER' : 'SPIELER')).toUpperCase();
  const initials = firstName && lastName 
    ? `${firstName[0]}${lastName[0]}` 
    : lastName.slice(0, 2);

  const palette = getPositionPalette(pos, p.category || 'player');

  // Athletic athletic portrait SVG with FC Auggen kit, subtle face profile silhouette, gradient stadium lights, badge and number
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#121824"/>
        <stop offset="50%" stop-color="#0A0E17"/>
        <stop offset="100%" stop-color="#05070B"/>
      </linearGradient>
      <linearGradient id="lightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="jerseyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.jerseyPrimary}"/>
        <stop offset="100%" stop-color="${palette.jerseySecondary}"/>
      </linearGradient>
      <radialGradient id="stadiumSpot" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.15"/>
        <stop offset="60%" stop-color="#0A0E17" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#0A0E17" stop-opacity="1"/>
      </radialGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="200" height="200" fill="url(#bgGrad)"/>
    <circle cx="100" cy="80" r="90" fill="url(#stadiumSpot)"/>

    <!-- Subtle pitch floodlight ring -->
    <circle cx="100" cy="100" r="94" fill="none" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.3"/>
    
    <!-- Player Silhouette & Athlete Body -->
    <g filter="url(#shadow)">
      <!-- Shoulders & Jersey -->
      <path d="M 28 200 C 32 150, 60 134, 82 130 C 88 140, 112 140, 118 130 C 140 134, 168 150, 172 200 Z" fill="url(#jerseyGrad)"/>
      
      <!-- Jersey Stripes / Design Accent -->
      <path d="M 85 131 L 82 200 L 118 200 L 115 131 Z" fill="${palette.jerseySecondary}" opacity="0.45"/>
      <path d="M 55 142 L 52 200 L 72 200 L 70 134 Z" fill="${palette.jerseySecondary}" opacity="0.35"/>
      <path d="M 145 142 L 148 200 L 128 200 L 130 134 Z" fill="${palette.jerseySecondary}" opacity="0.35"/>

      <!-- Collar & Neck Line -->
      <path d="M 85 130 C 92 142, 108 142, 115 130 Z" fill="${palette.collar}"/>
      <path d="M 88 126 C 88 115, 92 110, 100 110 C 108 110, 112 115, 112 126 Z" fill="#E2E8F0" opacity="0.9"/>

      <!-- Head / Athletic Face Silhouette -->
      <path d="M 72 78 C 70 48, 80 34, 100 34 C 120 34, 130 48, 128 78 C 126 98, 118 112, 100 112 C 82 112, 74 98, 72 78 Z" fill="#CBD5E1"/>
      
      <!-- Modern Hair / Athletic Cut -->
      <path d="M 70 65 C 68 44, 80 30, 100 30 C 120 30, 132 44, 130 65 C 126 50, 118 40, 100 40 C 82 40, 74 50, 70 65 Z" fill="#1E293B"/>

      <!-- FC Auggen Crest Outline on Chest -->
      <path d="M 58 155 L 67 155 L 67 165 C 67 170, 62.5 174, 62.5 174 C 62.5 174, 58 170, 58 165 Z" fill="#C00000" stroke="#FFFFFF" stroke-width="0.8"/>
    </g>

    <!-- Number Badge on Jersey or Top Right -->
    ${numberStr ? `
    <g transform="translate(142, 18)" filter="url(#shadow)">
      <rect width="42" height="32" rx="8" fill="#121824" stroke="${palette.accent}" stroke-width="1.5"/>
      <text x="21" y="22" fill="#FFFFFF" font-size="18" font-family="system-ui, -apple-system, sans-serif" font-weight="900" text-anchor="middle">#${numberStr}</text>
    </g>
    ` : ''}

    <!-- Position Badge Top Left -->
    <g transform="translate(16, 18)" filter="url(#shadow)">
      <rect width="46" height="22" rx="6" fill="${palette.badgeBg}"/>
      <text x="23" y="15" fill="#FFFFFF" font-size="10" font-family="system-ui, -apple-system, sans-serif" font-weight="900" text-anchor="middle" letter-spacing="0.5">${pos.slice(0, 5)}</text>
    </g>

    <!-- Bottom Name Banner -->
    <rect x="12" y="162" width="176" height="28" rx="7" fill="#0A0E17" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
    <text x="100" y="181" fill="#F8FAFC" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="800" text-anchor="middle" letter-spacing="0.5">
      ${lastName.length > 15 ? lastName.slice(0, 14) + '…' : lastName}
    </text>

    <!-- Subtle Inner Border -->
    <rect x="3" y="3" width="194" height="194" rx="16" fill="none" stroke="#334155" stroke-width="1.5" opacity="0.6"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Returns player photo or generated authentic player portrait
 */
export function getPlayerPhoto(player: any): string {
  if (!player) return '';
  if (player.image && typeof player.image === 'string' && player.image.trim().length > 10) {
    return player.image;
  }
  return generatePlayerAvatar({
    name: player.name,
    firstName: player.firstName,
    lastName: player.lastName,
    number: player.number ?? player.nummer,
    position: player.position,
    category: player.category
  });
}
