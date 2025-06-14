import type { City, GameState } from '../types';
import { cities } from '../data/cities';
import { calculateDistance } from './distance';

/**
 * Initialize the game state
 */
export function initializeGameState(): GameState {
  return {
    homeCity: null,
    currentRound: 0,
    totalRounds: 10,
    score: 0,
    currentChoices: null,
    lastResult: null,
    isLastRound: false,
    gamePhase: 'selection',
    playedCities: new Set<string>(),
    distanceMode: false
  };
}

/**
 * Select a home city to start the game
 */
export function selectHomeCity(gameState: GameState, cityId: string, customCity?: City, distanceMode: boolean = false): GameState {
  let homeCity: City | undefined;
  
  if (customCity) {
    homeCity = customCity;
  } else {
    homeCity = cities.find(city => city.id === cityId);
  }
  
  if (!homeCity) return gameState;
  
  const playedCities = new Set<string>([cityId]);
  
  return {
    ...gameState,
    homeCity,
    gamePhase: 'playing',
    playedCities,
    currentRound: 1,
    currentChoices: generateCityChoices(playedCities),
    distanceMode
  };
}

/**
 * Generate two random cities for the current round
 */
export function generateCityChoices(playedCities: Set<string>): [City, City] {
  const availableCities = cities.filter(city => !playedCities.has(city.id));
  
  // Randomly select two cities
  const index1 = Math.floor(Math.random() * availableCities.length);
  let index2 = Math.floor(Math.random() * (availableCities.length - 1));
  if (index2 >= index1) index2++;
  
  return [availableCities[index1], availableCities[index2]];
}

/**
 * Process the user's guess and update the game state
 */
export function makeGuess(gameState: GameState, cityId: string): GameState {
  if (!gameState.homeCity || !gameState.currentChoices) return gameState;
  
  const { homeCity, currentChoices, playedCities, currentRound, totalRounds, distanceMode } = gameState;
  const [city1, city2] = currentChoices;
  
  const guessCity = cityId === city1.id ? city1 : city2;
  const otherCity = cityId === city1.id ? city2 : city1;
  
  const distanceToGuess = calculateDistance(
    homeCity.latitude, homeCity.longitude,
    guessCity.latitude, guessCity.longitude
  );
  
  const distanceToOther = calculateDistance(
    homeCity.latitude, homeCity.longitude,
    otherCity.latitude, otherCity.longitude
  );
  
  const isCorrect = distanceToGuess <= distanceToOther;
  
  // Update the played cities
  const newPlayedCities = new Set(playedCities);
  newPlayedCities.add(city1.id);
  newPlayedCities.add(city2.id);

  // Prepare for the next round or end the game
  const isLastRound = currentRound >= totalRounds;
  
  return {
    ...gameState,
    lastResult: {
      guess: guessCity,
      other: otherCity,
      correct: isCorrect ? guessCity : otherCity,
      isCorrect,
      distanceToGuess,
      distanceToOther,
      distanceToCorrect: isCorrect ? distanceToGuess : distanceToOther
    },
    isLastRound: isLastRound,
    gamePhase: (distanceMode && isCorrect) ? 'distance-guess' : 'result',
    score: isCorrect ? gameState.score + 1000 : gameState.score,
    playedCities: newPlayedCities
  };
}

/**
 * Calculate bonus points based on distance accuracy
 */
export function calculateBonusPoints(actualDistance: number, guessedDistance: number): number {
  return Math.round(1000 * Math.max(0, 1 - 3 * Math.abs(Math.log10(guessedDistance / actualDistance))));
}

/**
 * Submit distance guess and calculate bonus points
 */
export function submitDistanceGuess(gameState: GameState, distanceGuess: number): GameState {
  if (!gameState.lastResult || gameState.gamePhase !== 'distance-guess') return gameState;
  
  const actualDistance = gameState.lastResult.distanceToGuess;
  const bonusPoints = calculateBonusPoints(actualDistance, distanceGuess);
  const accuracy = Math.abs(actualDistance - distanceGuess);
  
  return {
    ...gameState,
    lastResult: {
      ...gameState.lastResult,
      distanceGuess,
      distanceAccuracy: accuracy,
      bonusPoints
    },
    score: gameState.score + bonusPoints,
    gamePhase: 'result'
  };
}

/**
 * Advance to the next round
 */
export function nextRound(gameState: GameState): GameState {
  if (gameState.gamePhase !== 'result' || !gameState.homeCity) return gameState;

  if (gameState.isLastRound) {
    return {
      ...gameState,
      gamePhase: 'end'
    };
  }
  
  const nextRoundNumber = gameState.currentRound + 1;
  const newChoices = generateCityChoices(gameState.playedCities);
  
  return {
    ...gameState,
    currentRound: nextRoundNumber,
    currentChoices: newChoices,
    gamePhase: 'playing'
  };
}

/**
 * Restart the game
 */
export function restartGame(): GameState {
  return initializeGameState();
}