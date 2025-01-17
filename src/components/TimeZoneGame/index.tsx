import React, { useState, useCallback, useEffect } from 'react';
import { Clock, RotateCcw, Globe } from 'lucide-react';
import { locations } from './data/locations';
import { translations } from './data/translations';

type Language = 'en' | 'fr' | 'it' | 'ru';

interface GuessResult {
  locationId: number;
  attempts: number;
  correct: boolean;
}

function TimeZoneGame() {
  const [language, setLanguage] = useState<Language>('ru');
  const t = translations[language];
  
  const [gameLocations, setGameLocations] = useState<typeof locations>([]);
  const [currentLocation, setCurrentLocation] = useState(0);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<GuessResult[]>([]);
  const [gameComplete, setGameComplete] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize game locations only on client side
  useEffect(() => {
    setIsClient(true);
    const shuffledLocations = [...locations]
      .sort(() => Math.random() - 0.5)
      .slice(0, 7);
    setGameLocations(shuffledLocations);
  }, []);

  const resetGame = useCallback(() => {
    const newLocations = [...locations]
      .sort(() => Math.random() - 0.5)
      .slice(0, 7);
    setGameLocations(newLocations);
    setCurrentLocation(0);
    setHours('');
    setMinutes('');
    setAttempts(0);
    setShowAnswer(false);
    setResults([]);
    setGameComplete(false);
  }, []);

  const checkTime = () => {
    const location = gameLocations[currentLocation];
    const userTime = new Date();
    userTime.setHours(parseInt(hours));
    userTime.setMinutes(parseInt(minutes));

    const actualTime = new Date(new Date().toLocaleString('en-US', { timeZone: location.timezone }));
    const timeDiff = (Math.abs(userTime.getTime() - actualTime.getTime()) / 1000 / 60) % (24 * 60);

    if (timeDiff <= 2 || timeDiff >= 24 * 60 - 2) {
      setResults([...results, { locationId: location.id, attempts: attempts + 1, correct: true }]);
      nextLocation();
    } else {
      if (attempts >= 2) {
        setShowAnswer(true);
        setResults([...results, { locationId: location.id, attempts: 3, correct: false }]);
      } else {
        setAttempts(attempts + 1);
      }
    }
  };

  const nextLocation = () => {
    if (currentLocation === gameLocations.length - 1) {
      setGameComplete(true);
    } else {
      setCurrentLocation(currentLocation + 1);
      setHours('');
      setMinutes('');
      setAttempts(0);
      setShowAnswer(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: gameLocations[currentLocation].timezone 
    });
  };

  const calculateScore = () => {
    const correctGuesses = results.filter(r => r.correct).length;
    return Math.round((correctGuesses / gameLocations.length) * 100);
  };

  // Going to restore it later when I'm sure that all the translations are correct
  const LanguageSelector = () => (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      <Globe className="w-5 h-5 text-gray-600" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="it">Italiano</option>
        <option value="ru">Русский</option>
      </select>
    </div>
  );

  // Show loading state until client-side hydration is complete
  if (!isClient || gameLocations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <Clock className="w-8 h-8 text-blue-500 animate-pulse mx-auto" />
        </div>
      </div>
    );
  }

  if (gameComplete) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <Clock className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold mb-6">{t.gameComplete}</h1>
            <p className="text-xl mb-4">{t.yourScore}: {calculateScore()}%</p>
            {calculateScore() === 100 ? (
              <p className="text-green-600 font-semibold">{t.perfect}</p>
            ) : (
              <p className="text-gray-600">{t.goodTry}</p>
            )}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">{t.results}:</h2>
              {results.map((result, index) => (
                <div key={index} className="mb-2 text-left">
                  <span className="font-medium">{gameLocations[index].translations.city[language]}:</span>
                  {result.correct ? (
                    <>
                      {result.attempts == 1 && (
                        <span className='ml-2 text-green-600'>{t.correct}</span>
                      )}
                      {result.attempts == 2 && (
                        <span className='ml-2 text-yellow-600'>{t.correct} ({t.twoAttempts})</span>
                      )}
                      {result.attempts == 3 && (
                        <span className='ml-2 text-orange-600'>{t.correct} ({t.threeAttempts})</span>
                      )}
                    </>
                  ) : (
                    <span className='ml-2 text-red-600'>{t.incorrect}</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={resetGame}
              className="mt-8 bg-blue-500 text-white py-3 px-6 rounded-md hover:bg-blue-600 inline-flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              {t.playAgain}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const location = gameLocations[currentLocation];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full overflow-hidden">
        <img 
          src={location.image} 
          alt={location.translations.city[language]}
          className="w-full h-64 object-cover"
        />
        <div className="p-6">
          <h1 className="text-center text-2xl font-bold mb-0">{location.translations.city[language]}</h1>
          <p className="text-center text-gray-600 mb-4">{location.translations.country[language]}</p>
          
          {!showAnswer ? (
            <>
              <div className="text-center mb-4">
                <p>{t.enterTime}</p>
                {attempts == 1 && (
                  <p className="text-yellow-600 ml-2">
                    {t.wrongGuess} {t.twoAttemptsRemaining}
                  </p>
                )}
                {attempts == 2 && (
                  <p className="text-orange-600 ml-2">
                    {t.wrongGuess} {t.oneAttemptRemaining}
                  </p>
                )}
              </div>
              <div className="flex justify-center text-center gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.hours}</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-20 px-3 py-2 border rounded-md text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.minutes}</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-20 px-3 py-2 border rounded-md text-center"
                  />
                </div>
              </div>
              <button
                onClick={checkTime}
                disabled={!hours || !minutes}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {t.submit}
              </button>
            </>
          ) : (
            <div className="text-center">
              <p className="text-xl mb-4">
                {t.correctTimeIs}
                <br />
                <span className="font-bold text-2xl">
                  {formatTime(new Date())}
                </span>
              </p>
              <button
                onClick={nextLocation}
                className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600"
              >
                {t.next}
              </button>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-500 text-center">
            {t.locationCount} {currentLocation + 1} {t.of} {gameLocations.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeZoneGame;