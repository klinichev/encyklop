import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cities } from './data/cities';
import { useGameState } from './hooks/useGameState';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import DistanceGuessScreen from './components/DistanceGuessScreen';
import RoundResult from './components/RoundResult';
import EndScreen from './components/EndScreen';
import './index.css';

function DistanceGame() {
  const { gameState, selectHomeCity, selectCustomCity, makeGuess, submitDistanceGuess, nextRound, restartGame } = useGameState();

  const [isClient, setIsClient] = useState(false);
  
  // Update page title
  useEffect(() => {
    setIsClient(true);
    document.title = "Расстояния";
  }, []);

  // Show loading state until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <Clock className="w-8 h-8 text-blue-500 animate-pulse mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      {gameState.gamePhase === 'selection' && (
        <StartScreen 
          cities={cities} 
          onSelectCity={selectHomeCity} 
          onSelectCustomCity={selectCustomCity} 
        />
      )}
      
      {gameState.gamePhase === 'playing' && gameState.homeCity && gameState.currentChoices && (
        <GameScreen 
          homeCity={gameState.homeCity}
          currentRound={gameState.currentRound}
          totalRounds={gameState.totalRounds}
          cityChoices={gameState.currentChoices}
          score={gameState.score}
          distanceMode={gameState.distanceMode}
          onMakeGuess={makeGuess}
        />
      )}

      {gameState.gamePhase === 'distance-guess' && gameState.homeCity && gameState.lastResult && (
        <DistanceGuessScreen
          currentRound={gameState.currentRound}
          totalRounds={gameState.totalRounds}
          score={gameState.score}
          homeCity={gameState.homeCity}
          guessCity={gameState.lastResult.guess!}
          actualDistance={gameState.lastResult.distanceToGuess}
          onSubmitDistanceGuess={submitDistanceGuess}
        />
      )}
      
      {gameState.gamePhase === 'result' && gameState.homeCity && gameState.lastResult && (
        <RoundResult 
          currentRound={gameState.currentRound}
          totalRounds={gameState.totalRounds}
          score={gameState.score}
          homeCity={gameState.homeCity}
          guessCity={gameState.lastResult.guess!}
          otherCity={gameState.lastResult.other!}
          correctCity={gameState.lastResult.correct!}
          isCorrect={gameState.lastResult.isCorrect}
          distanceToGuess={gameState.lastResult.distanceToGuess}
          distanceToOther={gameState.lastResult.distanceToOther}
          distanceToCorrect={gameState.lastResult.distanceToCorrect}
          distanceGuess={gameState.lastResult.distanceGuess}
          distanceAccuracy={gameState.lastResult.distanceAccuracy}
          bonusPoints={gameState.lastResult.bonusPoints}
          isLastRound={gameState.isLastRound}
          onNextRound={nextRound}
        />
      )}
      
      {gameState.gamePhase === 'end' && gameState.homeCity && (
        <EndScreen 
          homeCity={gameState.homeCity}
          score={gameState.score}
          totalRounds={gameState.totalRounds}
          distanceMode={gameState.distanceMode}
          onRestart={restartGame}
        />
      )}
    </div>
  );
}

export default DistanceGame;