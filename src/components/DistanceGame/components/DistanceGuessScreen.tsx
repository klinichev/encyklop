import React, { useState } from 'react';
import type { City } from '../types';
import { Target, ArrowRight, MapPin } from 'lucide-react';

interface DistanceGuessScreenProps {
  currentRound: number;
  totalRounds: number;
  score: number;
  homeCity: City;
  guessCity: City;
  actualDistance: number;
  onSubmitDistanceGuess: (distanceGuess: number) => void;
}

const DistanceGuessScreen: React.FC<DistanceGuessScreenProps> = ({
  currentRound,
  totalRounds,
  score,
  homeCity,
  guessCity,
  actualDistance,
  onSubmitDistanceGuess
}) => {
  const [distanceGuess, setDistanceGuess] = useState<string>('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const guess = parseInt(distanceGuess);
    
    if (isNaN(guess) || guess < 0) {
      setError('Введите расстояние в километрах');
      return;
    }
    
    if (guess > 50000) {
      setError('Слишком много, на Земле такого не бывает!');
      return;
    }
    
    setError('');
    onSubmitDistanceGuess(guess);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

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
            <div className="bg-orange-50 text-orange-700 font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <Target size={14} />
                Усложнённый режим
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 text-center animate-fadeIn">
        <div className="flex justify-center mb-6">
          <div className="bg-orange-100 p-4 rounded-full">
            <Target size={32} className="text-orange-500" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4 text-gray-800">И это правильный ответ!</h2>
        <p className="text-gray-600 mb-6">
          <span className="font-semibold">{guessCity.name}</span> действительно ближе!
        </p>
        
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Дополнительное задание</h3>
          <p className="text-gray-700 mb-4">
            Теперь укажите расстояние между городами <br/><span className="font-semibold">{homeCity.name}</span> и <span className="font-semibold">{guessCity.name}</span>
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-4">
            <input
              type="number"
              value={distanceGuess}
              onChange={(e) => setDistanceGuess(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-32 px-4 py-2 border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              min="0"
              max="50000"
            />
            <span className="text-gray-600 font-medium">километров</span>
          </div>
          
          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!distanceGuess.trim()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Отправить <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default DistanceGuessScreen;