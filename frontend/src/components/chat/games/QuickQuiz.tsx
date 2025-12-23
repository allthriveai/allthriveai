import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faLightbulb } from '@fortawesome/free-solid-svg-icons';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// AI-themed trivia questions pool
const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "What does 'GPT' stand for in ChatGPT?",
    options: [
      "General Processing Tool",
      "Generative Pre-trained Transformer",
      "Guided Pattern Technology",
      "Global Predictive Text"
    ],
    correctIndex: 1,
    explanation: "GPT stands for Generative Pre-trained Transformer, a type of large language model architecture.",
    difficulty: 'easy'
  },
  {
    question: "Which company created Claude?",
    options: [
      "OpenAI",
      "Google",
      "Anthropic",
      "Meta"
    ],
    correctIndex: 2,
    explanation: "Claude was created by Anthropic, an AI safety company founded in 2021.",
    difficulty: 'easy'
  },
  {
    question: "What is a 'hallucination' in AI terms?",
    options: [
      "When AI sees images that aren't there",
      "When AI generates false or made-up information",
      "When AI refuses to answer questions",
      "When AI becomes self-aware"
    ],
    correctIndex: 1,
    explanation: "AI hallucination refers to when models generate plausible-sounding but factually incorrect information.",
    difficulty: 'medium'
  },
  {
    question: "What is 'prompt engineering'?",
    options: [
      "Building AI hardware",
      "Designing user interfaces for AI",
      "Crafting effective instructions for AI models",
      "Programming AI from scratch"
    ],
    correctIndex: 2,
    explanation: "Prompt engineering is the skill of writing effective prompts to get better results from AI models.",
    difficulty: 'easy'
  },
  {
    question: "What is the 'context window' in AI models?",
    options: [
      "The screen where you chat with AI",
      "The amount of text AI can consider at once",
      "The time it takes for AI to respond",
      "The visual interface settings"
    ],
    correctIndex: 1,
    explanation: "The context window is the maximum amount of text (measured in tokens) an AI model can process in a single conversation.",
    difficulty: 'medium'
  },
  {
    question: "What does 'fine-tuning' an AI model mean?",
    options: [
      "Making the AI speak more politely",
      "Training it further on specific data",
      "Adjusting screen brightness",
      "Reducing the model's size"
    ],
    correctIndex: 1,
    explanation: "Fine-tuning is the process of training a pre-existing model on specific data to specialize it for particular tasks.",
    difficulty: 'medium'
  },
  {
    question: "What is 'RLHF' used for in AI?",
    options: [
      "Recording Large Historical Files",
      "Running Learning on High-speed Frameworks",
      "Reinforcement Learning from Human Feedback",
      "Reducing Language Hallucination Frequency"
    ],
    correctIndex: 2,
    explanation: "RLHF (Reinforcement Learning from Human Feedback) is a technique to align AI behavior with human preferences.",
    difficulty: 'hard'
  },
  {
    question: "What is a 'token' in AI language models?",
    options: [
      "A cryptocurrency for AI services",
      "A piece of text (word or sub-word) the AI processes",
      "An authentication code",
      "A type of AI model"
    ],
    correctIndex: 1,
    explanation: "Tokens are chunks of text that AI models process. A word might be one token, or split into multiple tokens.",
    difficulty: 'medium'
  },
  {
    question: "What is 'zero-shot learning' in AI?",
    options: [
      "AI that learns without electricity",
      "AI performing tasks without examples",
      "AI that never makes mistakes",
      "AI that starts from scratch"
    ],
    correctIndex: 1,
    explanation: "Zero-shot learning is when an AI performs a task correctly without being given specific examples of that task.",
    difficulty: 'hard'
  },
  {
    question: "What is a 'multimodal' AI model?",
    options: [
      "AI that works on multiple devices",
      "AI that can process different types of input (text, images, audio)",
      "AI with multiple personalities",
      "AI that runs multiple times"
    ],
    correctIndex: 1,
    explanation: "Multimodal AI models can understand and generate multiple types of content, such as text, images, and audio.",
    difficulty: 'medium'
  }
];

interface QuickQuizProps {
  onComplete?: (score: number) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * QuickQuiz - Single question AI trivia for chat sidebar
 *
 * A quick, engaging trivia question about AI to keep users
 * entertained while learning something new.
 */
export function QuickQuiz({ onComplete, difficulty }: QuickQuizProps) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Pick a random question on mount
  useEffect(() => {
    let pool = QUIZ_QUESTIONS;
    if (difficulty) {
      pool = pool.filter(q => q.difficulty === difficulty);
    }
    if (pool.length === 0) pool = QUIZ_QUESTIONS;

    const randomIndex = Math.floor(Math.random() * pool.length);
    setQuestion(pool[randomIndex]);
  }, [difficulty]);

  const handleSelectOption = (index: number) => {
    if (showResult) return;

    setSelectedOption(index);
    setShowResult(true);

    // Calculate score (1 for correct, 0 for wrong)
    const score = index === question?.correctIndex ? 1 : 0;

    // Delay calling onComplete to let user see result
    setTimeout(() => {
      onComplete?.(score);
    }, 2000);
  };

  if (!question) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCorrect = selectedOption === question.correctIndex;

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <p className="text-white text-sm font-medium leading-relaxed">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrectOption = question.correctIndex === index;

          let buttonStyle = 'bg-slate-800/30 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600';

          if (showResult) {
            if (isCorrectOption) {
              buttonStyle = 'bg-green-500/20 border-green-500/50 text-green-400';
            } else if (isSelected && !isCorrectOption) {
              buttonStyle = 'bg-red-500/20 border-red-500/50 text-red-400';
            } else {
              buttonStyle = 'bg-slate-800/20 border-slate-700/30 text-slate-500';
            }
          }

          return (
            <button
              key={index}
              onClick={() => handleSelectOption(index)}
              disabled={showResult}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${buttonStyle} ${
                showResult ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{option}</span>
                {showResult && isCorrectOption && (
                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-green-400" />
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <FontAwesomeIcon icon={faTimes} className="w-4 h-4 text-red-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Result feedback */}
      {showResult && (
        <div className={`p-4 rounded-lg border ${
          isCorrect
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isCorrect ? 'bg-green-500/20' : 'bg-amber-500/20'
            }`}>
              <FontAwesomeIcon
                icon={isCorrect ? faCheck : faLightbulb}
                className={`w-4 h-4 ${isCorrect ? 'text-green-400' : 'text-amber-400'}`}
              />
            </div>
            <div>
              <p className={`text-sm font-medium ${isCorrect ? 'text-green-400' : 'text-amber-400'}`}>
                {isCorrect ? 'Correct!' : 'Not quite!'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {question.explanation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty badge */}
      <div className="flex justify-center">
        <span className={`px-2 py-1 text-xs rounded-full ${
          question.difficulty === 'easy'
            ? 'bg-green-500/20 text-green-400'
            : question.difficulty === 'medium'
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
        </span>
      </div>
    </div>
  );
}
