import { Star } from 'lucide-react';

interface RatingBadgeProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function RatingBadge({
  rating,
  maxRating = 10,
  size = 'md',
  showIcon = true,
}: RatingBadgeProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        bg-[rgba(255,159,10,0.15)]
        text-[#FF9F0A]
        font-semibold
        rounded-lg
        ${sizeClasses[size]}
      `}
    >
      {showIcon && <Star size={iconSizes[size]} fill="currentColor" />}
      <span>{rating.toFixed(1)}/{maxRating}</span>
    </div>
  );
}

// Star Rating Component for User Input
interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const starSizes = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function StarRating({
  value,
  onChange,
  maxStars = 10,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const normalizedValue = Math.min(Math.max(0, value), maxStars);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= normalizedValue;
        const isHalf = !isFilled && starValue - 0.5 <= normalizedValue;

        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(starValue)}
            className={`
              transition-all duration-150
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
              ${isFilled ? 'text-[#FFD60A]' : isHalf ? 'text-[#FFD60A]/50' : 'text-white/20'}
            `}
          >
            <Star
              size={starSizes[size]}
              fill={isFilled || isHalf ? 'currentColor' : 'none'}
              strokeWidth={isFilled || isHalf ? 0 : 1.5}
            />
          </button>
        );
      })}
      <span className="ml-2 text-white font-semibold">
        {normalizedValue}/{maxStars}
      </span>
    </div>
  );
}
