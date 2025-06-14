import React from 'react';
import type { City } from '../types';

interface CityCardProps {
  city: City;
  isSelectable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const CityCard: React.FC<CityCardProps> = ({ 
  city, 
  isSelectable = false,
  isSelected = false,
  onClick 
}) => {
  return (
    <div 
      className={`
        relative overflow-hidden rounded-lg shadow-md transition-all duration-300
        ${isSelectable ? 'cursor-pointer transform hover:scale-105 hover:shadow-lg' : ''}
        ${isSelected ? 'ring-4 ring-blue-500' : ''}
      `}
      onClick={isSelectable ? onClick : undefined}
    >
      <div className="relative h-40 md:h-48 overflow-hidden">
        <img 
          src={city.imageUrl} 
          alt={`${city.name}, ${city.country}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="mb-1 text-xl font-bold text-white">{city.name}</h3>
        <p className="mb-0 text-sm opacity-90 text-white">{city.country}</p>
      </div>
    </div>
  );
};

export default CityCard;