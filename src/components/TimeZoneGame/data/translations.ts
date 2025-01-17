interface Translation {
  gameTitle: string;
  enterTime: string;
  hours: string;
  minutes: string;
  submit: string;
  wrongGuess: string;
  twoAttemptsRemaining: string;
  oneAttemptRemaining: string; 
  correctTimeIs: string;
  next: string;
  locationCount: string;
  of: string;
  gameComplete: string;
  yourScore: string;
  perfect: string;
  goodTry: string;
  results: string;
  playAgain: string;
  correct: string;
  incorrect: string;
  twoAttempts: string;
  threeAttempts: string;
}

type Translations = {
  [key in 'en' | 'fr' | 'it' | 'ru']: Translation;
};

export const translations: Translations = {
  en: {
    gameTitle: "Time Zone Master",
    enterTime: "What's the current local time in this city?",
    hours: "Hours (24h)",
    minutes: "Minutes",
    submit: "Submit Guess",
    wrongGuess: "Wrong guess!",
    twoAttemptsRemaining: "2 attempts remaining.",
    oneAttemptRemaining: "1 attempt remaining.",
    correctTimeIs: "The correct time:",
    next: "Next Location",
    locationCount: "Location",
    of: "of",
    gameComplete: "Game Complete!",
    yourScore: "Your Score",
    perfect: "Perfect! You're a time zone master!",
    goodTry: "Good try! Keep practicing to improve your score.",
    results: "Results",
    playAgain: "Play Again",
    correct: "Correct",
    incorrect: "Incorrect",
    twoAttempts: "2 attempts",
    threeAttempts: "3 attempts",
  },
  fr: {
    gameTitle: "Maître des Fuseaux Horaires",
    enterTime: "Quelle est l'heure locale actuelle à cette ville ?",
    hours: "Heures (24h)",
    minutes: "Minutes",
    submit: "Soumettre",
    wrongGuess: "Mauvaise réponse !",
    twoAttemptsRemaining: "2 essais restants.",
    oneAttemptRemaining: "1 essai restant.",
    correctTimeIs: "L'heure correcte :",
    next: "Suivant",
    locationCount: "Lieu",
    of: "de",
    gameComplete: "Jeu Terminé !",
    yourScore: "Votre Score",
    perfect: "Parfait ! Vous êtes un maître des fuseaux horaires !",
    goodTry: "Bien essayé ! Continuez à vous entraîner pour vous améliorer.",
    results: "Résultats",
    playAgain: "Rejouer",
    correct: "Correct",
    incorrect: "Incorrect",
    twoAttempts: "2 essais",
    threeAttempts: "3 essais",
  },
  it: {
    gameTitle: "Maestro dei Fusi Orari",
    enterTime: "Qual è l'ora locale attuale in questa città?",
    hours: "Ore (24h)",
    minutes: "Minuti",
    submit: "Invia",
    wrongGuess: "Risposta sbagliata!",
    twoAttemptsRemaining: "2 tentativi rimasti.",
    oneAttemptRemaining: "1 tentativo rimasto.",
    correctTimeIs: "L'ora corretta:",
    next: "Avanti",
    locationCount: "Località",
    of: "di",
    gameComplete: "Gioco Completato!",
    yourScore: "Il Tuo Punteggio",
    perfect: "Perfetto! Sei un maestro dei fusi orari!",
    goodTry: "Buon tentativo! Continua a esercitarti per migliorare.",
    results: "Risultati",
    playAgain: "Gioca Ancora",
    correct: "Corretto",
    incorrect: "Sbagliato",
    twoAttempts: "2 tentativi",
    threeAttempts: "3 tentativi",
  },
  ru: {
    gameTitle: "Знаток часовых поясов",
    enterTime: "Сколько времени сейчас в этом городе?",
    hours: "Часы",
    minutes: "Минуты",
    submit: "Отправить",
    wrongGuess: "Неверно!",
    twoAttemptsRemaining: "Осталось 2 попытки.",
    oneAttemptRemaining: "Осталась 1 попытка.",
    correctTimeIs: "Правильный ответ:",
    next: "Далее",
    locationCount: "Локация",
    of: "из",
    gameComplete: "Игра завершена!",
    yourScore: "Ваш результат",
    perfect: "Отлично! Вы знаток часовых поясов!",
    goodTry: "Хорошая попытка, так держать!",
    results: "Результаты",
    playAgain: "Сыграть ещё раз",
    correct: "Верно",
    incorrect: "Неверно",
    twoAttempts: "2 попытки",
    threeAttempts: "3 попытки",
  },
};