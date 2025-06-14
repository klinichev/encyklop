import React from 'react';
import type { City } from '../types';
import CityCard from './CityCard';
import { MapPin, Target } from 'lucide-react';

interface GameScreenProps {
  homeCity: City;
  currentRound: number;
  totalRounds: number;
  cityChoices: [City, City];
  score: number;
  distanceMode: boolean;
  onMakeGuess: (cityId: string) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
  homeCity,
  currentRound,
  totalRounds,
  cityChoices,
  score,
  distanceMode,
  onMakeGuess
}) => {
  const [city1, city2] = cityChoices;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
          <div className="flex items-center">
            <MapPin className="text-red-500 mr-2" size={20} />
            <span className="text-lg font-medium">Город-база: {homeCity.name}, {homeCity.country}</span>
          </div>
          <div className="shrink-0 flex flex-wrap md:flex-nowrap justify-center items-center gap-4">
            <div className="bg-blue-50 text-blue-700 font-medium px-3 py-1 rounded-full">
              Раунд {currentRound}/{totalRounds}
            </div>
            <div className="bg-teal-50 text-teal-700 font-medium px-3 py-1 rounded-full">
              Счёт: {score}
            </div>
            {distanceMode && (
              <div className="bg-orange-50 text-orange-700 font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <Target size={14} />
                Усложнённый режим
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Какой город ближе к городу {homeCity.name}?</h2>
        <p className="text-gray-600">Нажмите на город, который находится ближе к городу-базе</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div 
          className="transition-transform duration-300 hover:scale-105"
          onClick={() => onMakeGuess(city1.id)}
        >
          <CityCard city={city1} isSelectable={true} />
        </div>
        <div 
          className="transition-transform duration-300 hover:scale-105"
          onClick={() => onMakeGuess(city2.id)}
        >
          <CityCard city={city2} isSelectable={true} />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;