import { useState } from 'react';
import type { City, GameState } from '../types';
import { 
  initializeGameState,
  selectHomeCity,
  makeGuess,
  submitDistanceGuess,
  nextRound,
  restartGame
} from '../utils/gameLogic';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(initializeGameState());
  
  const handleSelectHomeCity = (cityId: string, distanceMode: boolean = false) => {
    setGameState(currentState => selectHomeCity(currentState, cityId, undefined, distanceMode));
  };

  const handleSelectCustomCity = (city: City, distanceMode: boolean = false) => {
    setGameState(currentState => selectHomeCity(currentState, city.id, city, distanceMode));
  };

  const handleSubmitDistanceGuess = (distanceGuess: number) => {
    setGameState(currentState => submitDistanceGuess(currentState, distanceGuess));
  };
  
  const handleMakeGuess = (cityId: string) => {
    setGameState(currentState => makeGuess(currentState, cityId));
  };
  
  const handleNextRound = () => {
    setGameState(currentState => nextRound(currentState));
  };
  
  const handleRestartGame = () => {
    setGameState(restartGame());
  };
  
  return {
    gameState,
    selectHomeCity: handleSelectHomeCity,
    selectCustomCity: handleSelectCustomCity,
    makeGuess: handleMakeGuess,
    submitDistanceGuess: handleSubmitDistanceGuess,
    nextRound: handleNextRound,
    restartGame: handleRestartGame
  };
}