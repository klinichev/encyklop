import React from 'react';
import type { City } from '../types';
import { Check, X, ArrowRight, Target, Trophy, MapPin } from 'lucide-react';
import DistanceMap from './DistanceMap';

interface RoundResultProps {
  currentRound: number;
  totalRounds: number;
  score: number;
  homeCity: City;
  guessCity: City;
  otherCity: City;
  correctCity: City;
  isCorrect: boolean;
  distanceToGuess: number;
  distanceToOther: number;
  distanceToCorrect: number;
  distanceGuess?: number;
  distanceAccuracy?: number;
  bonusPoints?: number;
  isLastRound: boolean;
  onNextRound: () => void;
}

const RoundResult: React.FC<RoundResultProps> = ({
  currentRound,
  totalRounds,
  score,
  homeCity,
  guessCity,
  otherCity,
  correctCity,
  isCorrect,
  distanceToGuess,
  distanceToOther,
  distanceToCorrect,
  distanceGuess,
  distanceAccuracy,
  bonusPoints,
  isLastRound,
  onNextRound
}) => {
  const getBonusMessage = () => {
    if (!bonusPoints || bonusPoints === 0) return null;
    
    if (bonusPoints >= 900) {
      return { message: "Невероятная точность!", color: "text-green-600", icon: Trophy };
    } else if (bonusPoints >= 660) {
      return { message: "Очень хорошо!", color: "text-blue-600", icon: Target };
    } else {
      return { message: "Неплохая попытка!", color: "text-orange-600", icon: Target };
    }
  };

  const bonusInfo = getBonusMessage();

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
            {distanceGuess !== undefined && (
              <div className="bg-orange-50 text-orange-700 font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <Target size={14} />
                Усложнённый режим
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 animate-fadeIn">
        <div className="flex items-center justify-center mb-6">
          {isCorrect ? (
            <div className="bg-green-100 text-green-800 p-3 rounded-full">
              <Check size={28} />
            </div>
          ) : (
            <div className="bg-red-100 text-red-800 p-3 rounded-full">
              <X size={28} />
            </div>
          )}
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-6">
          {isCorrect ? 'Верно!' : 'Неверно!'}
        </h2>

        {/* Distance Challenge Results */}
        {distanceGuess !== undefined && isCorrect && (
          <div className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                {bonusInfo && <bonusInfo.icon size={24} className={bonusInfo.color} />}
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Результат дополнительного задания</h3>
              <div className="space-y-2 text-gray-700">
                <p className="mb-0">Ваш ответ: <span className="font-bold">{distanceGuess} км</span></p>
                <p>Правильный ответ: <span className="font-bold">{distanceToGuess} км</span></p>
                {bonusInfo && (
                  <p className={`font-semibold ${bonusInfo.color}`}>
                    {bonusInfo.message} +{bonusPoints} очков!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-6">
          <DistanceMap
            homeCity={homeCity}
            guessCity={guessCity}
            otherCity={otherCity}
            correctCity={correctCity}
          />
        </div>
        
        <div className="text-center">
          <div className="mb-6 space-y-2 text-gray-700">
            <p className="mb-0">
              <span className="font-medium">{homeCity.name} - {guessCity.name}</span>: {' '}
              <span className="font-medium">{distanceToGuess} км</span>
            </p>
            {!isCorrect && (
              <p>
                <span className="font-medium">{homeCity.name} - {correctCity.name}</span>: {' '}
                <span className="font-medium">{distanceToCorrect} км</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              {isCorrect 
                ? `Второй город (${otherCity.name}) находится на расстоянии ${distanceToOther} км`
                : `Разница в ${Math.abs(distanceToGuess - distanceToCorrect)} км`
              }
            </p>
          </div>
          
          <button 
            onClick={onNextRound}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            {isLastRound ? 'Закончить игру' : 'Дальше'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoundResult;