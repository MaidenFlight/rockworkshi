"use client";

import { Button } from "@/components/ui";
import Notation from "./Notation";
import s from "./rhythm.module.css";

const LETTERS = ["A", "B", "C"];

// Rhythmic dictation: three bars on paper, one of them played. They look alike on purpose; only
// listening tells them apart.
export default function NameIt({ quiz, score, counts, onPick, onNext, running }) {
  const done = quiz.picked !== null;
  return (
    <div className={s.quiz}>
      <p className={s.quizAsk}>{quiz.heard ? "Which rhythm did you hear?" : "Read all three, then press Play it to hear one of them."}</p>
      <div className={s.choices} role="group" aria-label="Choices">
        {quiz.options.map((bar, i) => {
          const state = !done ? undefined : i === quiz.answer ? "right" : i === quiz.picked ? "wrong" : "other";
          return (
            <button
              key={i}
              type="button"
              className={s.choice}
              data-state={state}
              aria-pressed={quiz.picked === i}
              disabled={!quiz.heard || done || running}
              onClick={() => onPick(i)}
            >
              <span className={s.choiceHead}>
                <span className={s.choiceLetter}>{LETTERS[i]}</span>
                {quiz.names && <span className={s.choiceName}>{quiz.names[i]}</span>}
                {state === "right" && <span className={s.choiceVerdict}>{quiz.picked === i ? "Right: you heard this" : "This was it"}</span>}
                {state === "wrong" && <span className={s.choiceVerdict}>Not this one</span>}
              </span>
              <Notation bars={[bar]} counts={counts} size="sm" label={`Choice ${LETTERS[i]}`} />
            </button>
          );
        })}
      </div>
      <div className={s.quizFoot}>
        <p className={s.quizScore}>
          {score.total ? `${score.right} of ${score.total} right` : "No answers yet"}
          {score.streak > 1 && ` · ${score.streak} in a row`}
        </p>
        {done && (
          <Button type="button" variant="secondary" size="sm" className={s.paperButton} onClick={onNext}>
            Next rhythm
          </Button>
        )}
      </div>
    </div>
  );
}
