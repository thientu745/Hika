import type { UserRank } from '../types';

/**
 * Get border styles for profile pictures based on user rank
 */
export const getRankBorderStyle = (rank: UserRank = 'Copper') => {
  const rankStyles: Record<
    UserRank,
    {
      borderColor: string;
      borderWidth: number;
      shadowColor?: string;
      shadowOpacity?: number;
      shadowRadius?: number;
      shadowOffset?: { width: number; height: number };
      elevation?: number; // For Android
    }
  > = {
    Copper: {
      borderColor: '#B87333',
      borderWidth: 2,
    },
    Bronze: {
      borderColor: '#CD7F32',
      borderWidth: 3,
      shadowColor: '#CD7F32',
      shadowOpacity: 0.3,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    Silver: {
      borderColor: '#C0C0C0',
      borderWidth: 3,
      shadowColor: '#C0C0C0',
      shadowOpacity: 0.4,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    Gold: {
      borderColor: '#FFD700',
      borderWidth: 4,
      shadowColor: '#FFD700',
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    Platinum: {
      borderColor: '#E5E4E2',
      borderWidth: 4,
      shadowColor: '#E5E4E2',
      shadowOpacity: 0.6,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    },
    Diamond: {
      borderColor: '#B9F2FF',
      borderWidth: 5,
      shadowColor: '#B9F2FF',
      shadowOpacity: 0.7,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
  };

  return rankStyles[rank];
};

