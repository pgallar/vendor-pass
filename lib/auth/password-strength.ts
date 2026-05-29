export type PasswordCriteria = {
  length8: boolean;
  lower: boolean;
  upper: boolean;
  number: boolean;
  symbol: boolean;
};

export type PasswordScore = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  criteria: PasswordCriteria;
};

export function scorePassword(pw: string): PasswordScore {
  const criteria: PasswordCriteria = {
    length8: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };

  const count = Object.values(criteria).filter(Boolean).length;

  let score: 0 | 1 | 2 | 3 | 4;
  let label: string;

  if (pw === '' || count === 0) {
    score = 0;
    label = 'Muy débil';
  } else if (count <= 2) {
    score = count as 1 | 2;
    label = 'Débil';
  } else if (count === 3) {
    score = 3;
    label = 'Media';
  } else {
    score = 4;
    label = 'Fuerte';
  }

  return { score, label, criteria };
}
