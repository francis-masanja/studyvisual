import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft, RotateCcw, Trophy, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import type { StudyMaterial, StudySection, StudyFlashcard } from '../../lib/parser';
import { cn } from '../../lib/utils';

const StudyVisualizer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        const res = await fetch(`/api/material?id=${id}`);
        const data = await res.json();
        if (data.material) {
          setMaterial(data.material.content_json);
        }
      } catch (error) {
        console.error("Error fetching material:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMaterial();
  }, [id]);

  if (isLoading) return <div className="min-h-screen bg-cozy-bg flex items-center justify-center text-cozy-text">Loading...</div>;
  if (!material) return <div className="min-h-screen bg-cozy-bg flex items-center justify-center text-cozy-text">Material not found.</div>;

  const hasCards = material.cards && material.cards.length > 0;
  // If the first card has options, we treat the whole set as a Quiz
  const isQuiz = hasCards && material.cards![0].options && material.cards![0].options.length > 0;

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex flex-col">
      <header className="p-4 border-b border-cozy-secondary/20 bg-cozy-card flex justify-between items-center sticky top-0 z-50">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-cozy-muted hover:text-cozy-text transition-colors"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex flex-col items-center">
          <h1 className="font-bold text-lg truncate max-w-[200px] md:max-w-xs">{material.title}</h1>
          <span className="text-[10px] uppercase tracking-widest text-cozy-primary font-bold">
            {isQuiz ? 'Interactive Quiz' : 'Study Notes'}
          </span>
        </div>
        <div className="w-24 hidden md:block" />
      </header>

      <main className="flex-1 flex flex-col">
        {material.type === 'mixed' ? (
          <Tabs.Root defaultValue="document" className="flex-1 flex flex-col">
            <Tabs.List className="flex justify-center gap-8 p-4 bg-cozy-card border-b border-cozy-secondary/10">
              <Tabs.Trigger 
                value="document"
                className="pb-2 px-4 font-bold text-cozy-muted data-[state=active]:text-cozy-primary data-[state=active]:border-b-2 data-[state=active]:border-cozy-primary transition-all"
              >
                Document
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="flashcards"
                className="pb-2 px-4 font-bold text-cozy-muted data-[state=active]:text-cozy-primary data-[state=active]:border-b-2 data-[state=active]:border-cozy-primary transition-all"
              >
                {isQuiz ? 'Quiz' : 'Flashcards'}
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="document" className="flex-1">
              <DocumentView sections={material.sections!} />
            </Tabs.Content>
            <Tabs.Content value="flashcards" className="flex-1 flex flex-col">
              {isQuiz ? <QuizView cards={material.cards!} materialId={id!} /> : <FlashcardView cards={material.cards!} />}
            </Tabs.Content>
          </Tabs.Root>
        ) : hasCards ? (
          isQuiz ? <QuizView cards={material.cards!} materialId={id!} /> : <FlashcardView cards={material.cards!} />
        ) : (
          <DocumentView sections={material.sections || []} />
        )}
      </main>
    </div>
  );
};

const QuizView = ({ cards, materialId }: { cards: StudyFlashcard[], materialId: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsInteractive] = useState(false);
  const [results, setResults] = useState<{ [key: string]: boolean }>({}); // cardId -> isCorrect
  const [showSummary, setShowSummary] = useState(false);

  // Load state from cache
  useEffect(() => {
    const cached = localStorage.getItem(`quiz_results_${materialId}`);
    if (cached) {
      setResults(JSON.parse(cached));
    }
  }, [materialId]);

  const handleAnswer = (option: string) => {
    if (isAnswered) return;
    const currentCard = cards[currentIndex];
    const isCorrect = option === currentCard.answer;
    
    setSelectedOption(option);
    setIsInteractive(true);
    
    const newResults = { ...results, [currentCard.id || currentIndex]: isCorrect };
    setResults(newResults);
    localStorage.setItem(`quiz_results_${materialId}`, JSON.stringify(newResults));

    // Update global score/streak
    if (isCorrect) {
      const currentScore = parseInt(localStorage.getItem('studyvisual_score') || '0');
      const currentStreak = parseInt(localStorage.getItem('studyvisual_streak') || '0');
      localStorage.setItem('studyvisual_score', (currentScore + 5).toString());
      localStorage.setItem('studyvisual_streak', (currentStreak + 1).toString());
    } else {
      localStorage.setItem('studyvisual_streak', '0');
    }
  };

  const nextQuestion = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsInteractive(false);
    } else {
      setShowSummary(true);
    }
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsInteractive(false);
    setShowSummary(false);
    setResults({});
    localStorage.removeItem(`quiz_results_${materialId}`);
  };

  if (showSummary) {
    const correctCount = Object.values(results).filter(v => v).length;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-cozy-card p-10 rounded-[3rem] shadow-2xl border border-cozy-secondary/20 max-w-md w-full">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
          <h2 className="text-3xl font-extrabold mb-2">Quiz Complete!</h2>
          <p className="text-cozy-muted mb-8 font-medium">You scored {correctCount} out of {cards.length}</p>
          
          <div className="space-y-4 mb-10">
            <div className="flex justify-between items-center p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
              <span className="font-bold text-green-600 flex items-center gap-2"><CheckCircle2 size={18}/> Correct</span>
              <span className="text-xl font-black text-green-600">{correctCount}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
              <span className="font-bold text-red-600 flex items-center gap-2"><AlertCircle size={18}/> Wrong</span>
              <span className="text-xl font-black text-red-600">{cards.length - correctCount}</span>
            </div>
          </div>

          <button 
            onClick={resetQuiz}
            className="w-full bg-cozy-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-cozy-primary/90 transition-all active:scale-95 shadow-lg"
          >
            <RotateCcw size={20} /> Restart Quiz
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-10 gap-6 max-w-full">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span className="text-cozy-muted">Question {currentIndex + 1} of {cards.length}</span>
          <span className="text-cozy-primary">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-cozy-accent h-2 rounded-full overflow-hidden">
          <div className="bg-cozy-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="w-full max-w-2xl bg-cozy-card rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-cozy-secondary/20 flex flex-col">
        <h2 className="text-xl md:text-3xl font-bold leading-tight mb-10 text-cozy-text">
          {currentCard.question}
        </h2>

        <div className="space-y-4">
          {currentCard.options?.map((opt, i) => {
            const isCorrect = opt === currentCard.answer;
            const isSelected = opt === selectedOption;
            
            let btnClass = "bg-cozy-bg border-cozy-secondary/20 hover:border-cozy-primary hover:bg-cozy-accent";
            if (isAnswered) {
              if (isCorrect) btnClass = "bg-green-500/10 border-green-500 text-green-700 font-bold";
              else if (isSelected) btnClass = "bg-red-500/10 border-red-500 text-red-700 font-bold";
              else btnClass = "bg-cozy-bg border-cozy-secondary/10 opacity-50";
            }

            return (
              <button
                key={i}
                disabled={isAnswered}
                onClick={() => handleAnswer(opt)}
                className={cn(
                  "w-full p-4 md:p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group",
                  btnClass
                )}
              >
                <span className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  isAnswered && isCorrect ? "bg-green-500 text-white" : isAnswered && isSelected ? "bg-red-500 text-white" : "bg-cozy-accent group-hover:bg-cozy-primary group-hover:text-white"
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {isAnswered && isCorrect && <CheckCircle2 className="text-green-600" size={24} />}
                {isAnswered && isSelected && !isCorrect && <AlertCircle className="text-red-600" size={24} />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            <button 
              onClick={nextQuestion}
              className="w-full bg-cozy-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cozy-primary/20 hover:bg-cozy-primary/90 transition-all active:scale-95"
            >
              {currentIndex === cards.length - 1 ? 'Finish Quiz' : 'Next Question'} <ChevronRight size={20} />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const FlashcardView = ({ cards }: { cards: StudyFlashcard[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0);

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-10 gap-6 max-w-full overflow-hidden">
      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span className="text-cozy-muted">Flashcard {currentIndex + 1} / {cards.length}</span>
          <span className="text-cozy-primary">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-cozy-accent h-2 rounded-full overflow-hidden">
          <div 
            className="bg-cozy-primary h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card Container */}
      <div className="relative w-full max-w-2xl flex-1 flex flex-col perspective-1000">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.x < -100) nextCard();
              else if (info.offset.x > 100) prevCard();
            }}
            className="w-full h-full flex flex-col"
          >
            <motion.div
              className="w-full h-full flex-1 cursor-pointer preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Question Side */}
              <div className="absolute inset-0 backface-hidden bg-cozy-card rounded-[2.5rem] p-6 md:p-12 flex flex-col items-start shadow-xl border border-cozy-secondary/20 overflow-y-auto">
                <div className="w-full flex justify-between items-center mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-cozy-muted">Study Question</span>
                  <div className="md:hidden text-[10px] text-cozy-muted bg-cozy-accent px-2 py-1 rounded-full">Swipe</div>
                </div>
                
                <p className="text-xl md:text-3xl font-bold leading-tight text-cozy-text mb-8">{card.question}</p>
                
                <div className="mt-auto pt-8 w-full text-center">
                  <p className="text-xs text-cozy-muted italic bg-cozy-accent/30 py-2 rounded-full inline-block px-6">Click card to reveal answer</p>
                </div>
              </div>

              {/* Answer Side */}
              <div className="absolute inset-0 backface-hidden bg-cozy-primary rounded-[2.5rem] p-6 md:p-12 flex flex-col items-start shadow-xl border border-cozy-primary rotate-y-180 text-white overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-6">Note / Explanation</span>
                
                <div className="flex-1 flex flex-col justify-center w-full">
                   <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">{card.answer}</p>
                </div>

                <div className="mt-auto pt-8 w-full text-center">
                  <p className="text-xs opacity-70 italic border border-white/20 py-2 rounded-full inline-block px-6">Click to flip back</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-6 mt-2">
        <button 
          onClick={prevCard}
          disabled={currentIndex === 0}
          className="p-4 bg-cozy-card rounded-2xl shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-all text-cozy-primary border border-cozy-secondary/10 active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        <button 
          onClick={nextCard}
          disabled={currentIndex === cards.length - 1}
          className="p-4 bg-cozy-card rounded-2xl shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-all text-cozy-primary border border-cozy-secondary/10 active:scale-95"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

const DocumentView = ({ sections }: { sections: StudySection[] }) => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6 space-y-12">
      {sections.map((section, idx) => (
        <motion.section 
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-cozy-card p-8 md:p-12 rounded-3xl shadow-sm border border-cozy-secondary/10"
        >
          <h2 className="text-2xl font-bold mb-6 text-cozy-primary flex items-center gap-3">
            <span className="w-8 h-8 bg-cozy-accent rounded-full flex items-center justify-center text-sm">{idx + 1}</span>
            {section.subtitle}
          </h2>
          <div 
            className="prose prose-cozy max-w-none leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        </motion.section>
      ))}
      <div className="py-12 text-center text-cozy-text">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold">You've finished this document!</h3>
      </div>
    </div>
  );
};

export default StudyVisualizer;