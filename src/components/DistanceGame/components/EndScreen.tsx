import React from 'react';
import type { City } from '../types';
import { TrophyIcon, RotateCcw } from 'lucide-react';

interface EndScreenProps {
  homeCity: City;
  score: number;
  totalRounds: number;
  distanceMode: boolean;
  onRestart: () => void;
}

const EndScreen: React.FC<EndScreenProps> = ({
  homeCity,
  score,
  totalRounds,
  distanceMode,
  onRestart
}) => {
  const normalizedScore = distanceMode ? score / 2000 : score / 1000;
  const percentage = Math.round((normalizedScore / totalRounds) * 100);
  
  const getFeedback = (): { title: string; message: string } => {
    if (percentage >= 85) {
      return {
        title: "Уровень: эксперт",
        message: "Восхитительный результат! Этот мир вам абсолютно понятен"
      };
    } else if (percentage >= 70) {
      return {
        title: "Опытный путешественник",
        message: "Хороший результат! Вы отлично чувствуете расстояния"
      };
    } else if (percentage >= 50) {
      return {
        title: "Активный исследователь",
        message: "Неплохо, очень даже неплохо!"
      };
    } else {
      return {
        title: "Путешествия только начинаются",
        message: "Некоторые города на самом деле ближе, чем кажется. А некоторые дальше... Ещё столько всего предстоит исследовать!"
      };
    }
  };
  
  const feedback = getFeedback();
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center animate-fadeIn">
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-100 p-4 rounded-full">
            <TrophyIcon size={48} className="text-yellow-500" />
          </div>
        </div>
        
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{feedback.title}</h2>
        <p className="text-gray-600 mb-6">{feedback.message}</p>

        <div className="mb-8">
          <p className="text-gray-500 mb-2">Вы набрали</p>
          <div className="text-5xl font-bold text-blue-600 mb-2">
            {score}
          </div>
          {distanceMode ? (
            <p className="text-gray-500">очков в усложнённом режиме игры</p>
          ) : (
            <p className="text-gray-500">очков</p>
          )}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 mb-6">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {!distanceMode && (
          <p className="mb-8 text-gray-700">
            Вы {normalizedScore} из {totalRounds} раз угадали, какой город ближе к городу {homeCity.name}.
          </p>
        )}
        
        <button
          onClick={onRestart}
          className="inline-flex items-center mt-4 gap-2 px-6 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <RotateCcw size={18} />
          Сыграть ещё раз
        </button>
      </div>
    </div>
  );
};

export default EndScreen;