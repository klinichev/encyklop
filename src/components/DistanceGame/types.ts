export interface City {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
}

export interface GameState {
  homeCity: City | null;
  currentRound: number;
  totalRounds: number;
  score: number;
  currentChoices: [City, City] | null;
  lastResult: {
    guess: City | null;
    other: City | null;
    correct: City | null;
    isCorrect: boolean;
    distanceToGuess: number;
    distanceToOther: number;
    distanceToCorrect: number;
    distanceGuess?: number;
    distanceAccuracy?: number;
    bonusPoints?: number;
  } | null;
  isLastRound: boolean;
  gamePhase: 'selection' | 'playing' | 'result' | 'distance-guess' | 'end';
  playedCities: Set<string>;
  distanceMode: boolean;
}