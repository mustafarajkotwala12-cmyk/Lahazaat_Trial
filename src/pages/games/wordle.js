import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import WordleGrid from '../../components/WordleGrid';
import WordleKeyboard from '../../components/WordleKeyboard';
import validWords from '../../lib/validWords';
import { supabase } from '../../lib/supabase';

const MAX_GUESSES = 6;
const GAME_NAME = 'wordle';

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPreviousDateString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function calculateNextCurrentStreak(result, priorStats, yesterday) {
  if (result !== 'won') {
    return 0;
  }

  const priorPlayedYesterday = priorStats.last_played_date === yesterday;
  const priorWin = priorStats.last_result === 'won';

  if (priorPlayedYesterday && priorWin) {
    return (priorStats.current_streak ?? 0) + 1;
  }

  return 1;
}

function evaluateGuess(guess, target) {
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  const result = guessLetters.map((letter) => ({ letter, state: 'absent' }));
  const remaining = [...targetLetters];

  guessLetters.forEach((letter, index) => {
    if (letter === targetLetters[index]) {
      result[index].state = 'correct';
      remaining[index] = null;
    }
  });

  guessLetters.forEach((letter, index) => {
    if (result[index].state === 'correct') {
      return;
    }

    const matchIndex = remaining.indexOf(letter);
    if (matchIndex !== -1) {
      result[index].state = 'present';
      remaining[matchIndex] = null;
    }
  });

  return { word: guess, letters: result };
}

function buildKeyboardStatuses(guesses) {
  const priority = {
    absent: 0,
    present: 1,
    correct: 2,
  };

  return guesses.reduce((accumulator, guess) => {
    guess.letters.forEach(({ letter, state }) => {
      const key = letter.toLowerCase();
      if (!key) {
        return;
      }

      if (!(key in accumulator) || priority[state] > priority[accumulator[key]]) {
        accumulator[key] = state;
      }
    });

    return accumulator;
  }, {});
}

export default function WordlePage() {
  const [user, setUser] = useState(null);
  const [dailyWord, setDailyWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState('playing');
  const [stats, setStats] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('Loading today\'s word...');
  const [toastMessage, setToastMessage] = useState('');
  const [shakeRowIndex, setShakeRowIndex] = useState(null);

  const today = useMemo(() => getTodayDateString(), []);
  const yesterday = useMemo(() => getPreviousDateString(today), [today]);
  const letterStatuses = useMemo(() => buildKeyboardStatuses(guesses), [guesses]);
  const isGameInteractive = !isLoading && !isLocked && gameStatus === 'playing' && Boolean(dailyWord);
  const hasPlayedToday = stats?.last_played_date === today;
  const shouldShowStats = Boolean(stats) && isLocked;
  const statusLabel = hasPlayedToday ? (stats?.last_result === 'won' ? 'Won' : 'Locked') : 'In Progress';

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage('');
    }, 2200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toastMessage]);

  useEffect(() => {
    let isActive = true;

    async function initializeGame() {
      setIsLoading(true);

      const [{ data: authData, error: authError }, { data: dailyData, error: dailyError }] =
        await Promise.all([
          supabase.auth.getSession(),
          supabase
            .from('daily_words')
            .select('solution_word, play_date')
            .eq('play_date', today)
            .maybeSingle(),
        ]);

      if (!isActive) {
        return;
      }

      if (authError) {
        console.error('Error loading user:', authError);
      }

      if (dailyError) {
        console.error('Error loading daily word:', dailyError);
        setMessage('Unable to load today\'s Wordle. Check daily_words access in Supabase.');
        setIsLoading(false);
        return;
      }

      if (!dailyData?.solution_word) {
        console.error(`No daily_words row found for ${today}.`);
        setMessage(`No Wordle has been published for ${today} yet.`);
        setIsLoading(false);
        return;
      }

      const nextUser = authData?.session?.user ?? null;
      setUser(nextUser);
      setDailyWord(String(dailyData.solution_word).toLowerCase());

      if (!nextUser) {
        setMessage('Guess the five-letter word. Sign in to save your streak.');
        setIsLoading(false);
        return;
      }
      const { data: existingStats, error: statsError } = await supabase
        .from('game_stats')
        .select('*')
        .eq('user_id', nextUser.id)
        .eq('game_type', GAME_NAME)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (statsError) {
        console.error('Error loading game stats:', statsError);
      }

      setStats(existingStats ?? null);

      if (existingStats?.last_played_date === today) {
        setIsLocked(true);
        setGameStatus(existingStats.last_result === 'won' ? 'won' : 'lost');
        setMessage('You already completed today\'s Wordle. Come back tomorrow.');
      } else {
        setMessage('Guess the five-letter word.');
      }

      setIsLoading(false);
    }

    initializeGame();

    return () => {
      isActive = false;
    };
  }, [today]);

  const triggerInvalidGuess = useCallback(() => {
    setShakeRowIndex(guesses.length);
    setToastMessage('Not in word list');
    window.setTimeout(() => {
      setShakeRowIndex(null);
    }, 420);
  }, [guesses.length]);

  const persistGameResult = useCallback(async (result, guessCount) => {
    if (!user) {
      return;
    }

    const priorStats = stats ?? {};
    const currentStreak = calculateNextCurrentStreak(result, priorStats, yesterday);

    const maxStreak = Math.max(priorStats.max_streak ?? 0, currentStreak);

    const wins = (priorStats.wins ?? 0) + (result === 'won' ? 1 : 0);
    const losses = (priorStats.losses ?? 0) + (result === 'lost' ? 1 : 0);
    const gamesPlayed = (priorStats.games_played ?? 0) + 1;

    const payload = {
      user_id: user.id,
      game_type: GAME_NAME,
      game_name: GAME_NAME,
      last_played_date: today,
      last_result: result,
      current_streak: currentStreak,
      max_streak: maxStreak,
      wins,
      losses,
      games_played: gamesPlayed,
      last_guess_count: guessCount,
    };

    const { data, error } = await supabase
      .from('game_stats')
      .upsert(payload, {
        onConflict: 'user_id,game_type',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating game stats:', error);
      return;
    }

    setStats(data ?? payload);
  }, [stats, today, user, yesterday]);

  const submitGuess = useCallback(async () => {
    if (!isGameInteractive) {
      return;
    }

    const normalizedGuess = currentGuess.toLowerCase();

    if (normalizedGuess.length !== 5 || !validWords.has(normalizedGuess)) {
      triggerInvalidGuess();
      return;
    }

    const evaluatedGuess = evaluateGuess(normalizedGuess, dailyWord);
    const nextGuesses = [...guesses, evaluatedGuess];
    setGuesses(nextGuesses);
    setCurrentGuess('');

    if (normalizedGuess === dailyWord) {
      setGameStatus('won');
      setMessage('You solved today\'s Wordle.');
      await persistGameResult('won', nextGuesses.length);
      setIsLocked(true);
      return;
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      setGameStatus('lost');
      setMessage(`Out of guesses. Today's word was ${dailyWord.toUpperCase()}.`);
      await persistGameResult('lost', nextGuesses.length);
      setIsLocked(true);
      return;
    }

    setMessage(`${MAX_GUESSES - nextGuesses.length} guesses remaining.`);
  }, [currentGuess, dailyWord, guesses, isGameInteractive, persistGameResult, triggerInvalidGuess]);

  const handleKeyPress = useCallback((key) => {
    if (!isGameInteractive) {
      return;
    }

    if (key === 'Enter') {
      submitGuess();
      return;
    }

    if (key === 'Backspace') {
      setCurrentGuess((value) => value.slice(0, -1));
      return;
    }

    if (/^[A-Z]$/.test(key)) {
      setCurrentGuess((value) => (value.length < 5 ? `${value}${key.toLowerCase()}` : value));
    }
  }, [isGameInteractive, submitGuess]);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key;

      if (key === 'Enter' || key === 'Backspace') {
        event.preventDefault();
        handleKeyPress(key);
        return;
      }

      if (/^[a-zA-Z]$/.test(key)) {
        handleKeyPress(key.toUpperCase());
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyPress]);

  return (
    <>
      <Head>
        <title>Wordle | Lahazaat</title>
        <meta name="description" content="Play the daily Lahazaat Wordle." />
      </Head>

      <div className="mx-auto flex w-full max-w-[32rem] flex-col items-center gap-5">
        <header className="w-full border-b border-[#d3d6da] pb-3 text-center">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#787c7e]">
            Lahazaat Games
          </p>
          <h1 className="mt-2 text-[2.2rem] font-bold tracking-[0.12em] text-[#1a1a1b]">
            WORDLE
          </h1>
          <p className="mt-2 text-sm text-[#787c7e]">{message}</p>
        </header>

        {toastMessage ? (
          <div className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded bg-[#1a1a1b] px-4 py-2 text-sm font-semibold text-white">
            {toastMessage}
          </div>
        ) : null}

        <div className="flex w-full flex-col items-center gap-3">
          <div className="w-full max-w-[19.8rem]">
            <WordleGrid
              guesses={guesses}
              currentGuess={currentGuess}
              shakeRowIndex={shakeRowIndex}
            />
          </div>
          <WordleKeyboard
            onKeyPress={handleKeyPress}
            letterStatuses={letterStatuses}
            disabled={!isGameInteractive}
          />
        </div>

        {shouldShowStats ? (
          <section className="grid w-full gap-3 rounded border border-[#d3d6da] bg-white p-4 text-[#3a3a3c] md:grid-cols-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#787c7e]">Status</p>
              <p className="mt-1 text-xl font-semibold">{statusLabel}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#787c7e]">Current Streak</p>
              <p className="mt-1 text-xl font-semibold">{stats.current_streak ?? 0}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#787c7e]">Max Streak</p>
              <p className="mt-1 text-xl font-semibold">{stats.max_streak ?? 0}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#787c7e]">Last Played</p>
              <p className="mt-1 text-xl font-semibold">{stats.last_played_date ?? 'Never'}</p>
            </div>
          </section>
        ) : null}

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/games"
            className="text-[#787c7e] hover:text-[#1a1a1b]"
          >
            Back to games
          </Link>
          <span className="text-[#787c7e]">
            Loaded dictionary entries: {validWords.size.toLocaleString()}
          </span>
        </div>
      </div>
    </>
  );
}
