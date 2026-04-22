const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Backspace', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Enter'],
];

const KEY_STATE_CLASSES = {
  default:
    'border-[#d3d6da] bg-[#d3d6da] text-[#1a1a1b] hover:bg-[#cfd2d6]',
  correct:
    'border-[#6aaa64] bg-[#6aaa64] text-white',
  present:
    'border-[#c9b458] bg-[#c9b458] text-white',
  absent:
    'border-[#787c7e] bg-[#787c7e] text-white',
};

export default function WordleKeyboard({ onKeyPress, letterStatuses = {}, disabled = false }) {
  return (
    <div className="mx-auto flex w-full max-w-[31rem] flex-col gap-2">
      {KEYBOARD_ROWS.map((row) => (
        <div key={row.join('')} className="flex justify-center gap-1.5">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onKeyPress?.(key)}
              className={`flex h-12 items-center justify-center rounded border text-[0.8rem] font-bold transition active:scale-[0.98] ${
                key === 'Enter' || key === 'Backspace' ? 'w-[4.35rem]' : 'w-9'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                KEY_STATE_CLASSES[letterStatuses[key.toLowerCase()]] || KEY_STATE_CLASSES.default
              }`}
            >
              {key === 'Backspace' ? '⌫' : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
