const TILE_STATE_CLASSES = {
  empty:
    'border-[#d3d6da] bg-white text-[#1a1a1b]',
  typing:
    'border-[#878a8c] bg-white text-[#1a1a1b]',
  correct:
    'wordle-tile-flip border-[#6aaa64] bg-[#6aaa64] text-white',
  present:
    'wordle-tile-flip border-[#c9b458] bg-[#c9b458] text-white',
  absent:
    'wordle-tile-flip border-[#787c7e] bg-[#787c7e] text-white',
};

function normalizeGuess(guess) {
  if (typeof guess === 'string') {
    return guess
      .padEnd(5)
      .slice(0, 5)
      .split('')
      .map((letter) => ({
        letter,
        state: letter ? 'absent' : 'empty',
      }));
  }

  if (Array.isArray(guess?.letters)) {
    return guess.letters.map((cell) => ({
      letter: cell?.letter || '',
      state: cell?.state || (cell?.letter ? 'typing' : 'empty'),
    }));
  }

  return Array.from({ length: 5 }, () => ({ letter: '', state: 'empty' }));
}

export default function WordleGrid({
  guesses = [],
  currentGuess = '',
  maxRows = 6,
  shakeRowIndex = null,
}) {
  const rows = Array.from({ length: maxRows }, (_, rowIndex) => {
    if (guesses[rowIndex]) {
      return normalizeGuess(guesses[rowIndex]);
    }

    if (rowIndex === guesses.length) {
      return currentGuess
        .padEnd(5)
        .slice(0, 5)
        .split('')
        .map((letter) => ({
          letter,
          state: letter ? 'typing' : 'empty',
        }));
    }

    return Array.from({ length: 5 }, () => ({ letter: '', state: 'empty' }));
  });

  return (
    <div className="grid gap-1.5">
      {rows.map((letters, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={`grid grid-cols-5 gap-1.5 ${shakeRowIndex === rowIndex ? 'wordle-row-shake' : ''}`}
        >
          {letters.map(({ letter, state }, cellIndex) => (
            <div
              key={`cell-${rowIndex}-${cellIndex}`}
              className={`flex aspect-square items-center justify-center border-2 text-[1.72rem] font-bold uppercase leading-none transition-transform duration-150 ${TILE_STATE_CLASSES[state] || TILE_STATE_CLASSES.empty}`}
              style={{
                animationDelay: state === 'correct' || state === 'present' || state === 'absent'
                  ? `${cellIndex * 90}ms`
                  : undefined,
              }}
            >
              <span>{letter}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
