import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import type { StudyMaterial, StudySection, StudyFlashcard } from '../../lib/parser';

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

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex flex-col">
      <header className="p-4 border-b border-cozy-secondary/20 bg-cozy-card flex justify-between items-center sticky top-0 z-50">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-cozy-muted hover:text-cozy-text transition-colors"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h1 className="font-bold text-lg truncate max-w-xs">{material.title}</h1>
        <div className="w-24" />
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
                Flashcards
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="document" className="flex-1">
              <DocumentView sections={material.sections!} />
            </Tabs.Content>
            <Tabs.Content value="flashcards" className="flex-1 flex flex-col">
              <FlashcardView cards={material.cards!} />
            </Tabs.Content>
          </Tabs.Root>
        ) : hasCards ? (
          <FlashcardView cards={material.cards!} />
        ) : (
          <DocumentView sections={material.sections || []} />
        )}
      </main>
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
          <span className="text-cozy-muted">Question {currentIndex + 1} / {cards.length}</span>
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
                  <span className="text-xs font-bold uppercase tracking-widest text-cozy-muted">Question</span>
                  <div className="md:hidden text-[10px] text-cozy-muted bg-cozy-accent px-2 py-1 rounded-full">Swipe to Navigate</div>
                </div>
                
                <p className="text-xl md:text-3xl font-bold leading-tight text-cozy-text mb-8">{card.question}</p>
                
                {card.options && card.options.length > 0 && (
                  <div className="w-full space-y-3 mb-6">
                    {card.options.map((opt, i) => (
                      <div 
                        key={i}
                        className="p-4 bg-cozy-accent/30 rounded-2xl border border-cozy-secondary/10 text-sm md:text-lg font-medium text-cozy-text flex gap-4 items-center"
                      >
                        <span className="w-8 h-8 bg-cozy-primary/10 rounded-full flex items-center justify-center text-sm text-cozy-primary shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-auto pt-8 w-full text-center">
                  <p className="text-xs text-cozy-muted italic bg-cozy-accent/30 py-2 rounded-full inline-block px-6">Click card to reveal answer</p>
                </div>
              </div>

              {/* Answer Side */}
              <div className="absolute inset-0 backface-hidden bg-cozy-primary rounded-[2.5rem] p-6 md:p-12 flex flex-col items-start shadow-xl border border-cozy-primary rotate-y-180 text-white overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-6">Correct Answer</span>
                
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

      {/* Navigation Buttons (Desktop only or for accessibility) */}
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

export default StudyVisualizer;
