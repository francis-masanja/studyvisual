import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Layers, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
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

  const hasSections = material.sections && material.sections.length > 0;
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

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-cozy-accent h-2 rounded-full overflow-hidden">
          <div 
            className="bg-cozy-primary h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative w-full max-w-2xl aspect-video md:aspect-[16/9] perspective-1000">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full h-full"
          >
            <motion.div
              className="w-full h-full cursor-pointer preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Question Side */}
              <div className="absolute inset-0 backface-hidden bg-cozy-card rounded-[2.5rem] p-8 md:p-12 flex flex-col items-start justify-center text-left shadow-xl border border-cozy-secondary/20 overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-widest text-cozy-muted mb-4">Question</span>
                <p className="text-xl md:text-2xl font-bold leading-tight text-cozy-text mb-6">{card.question}</p>
                
                {card.options && card.options.length > 0 && (
                  <div className="w-full space-y-3 mb-6">
                    {card.options.map((opt, i) => (
                      <div 
                        key={i}
                        className="p-4 bg-cozy-accent/30 rounded-2xl border border-cozy-secondary/10 text-sm md:text-base font-medium text-cozy-text flex gap-3 items-center"
                      >
                        <span className="w-6 h-6 bg-cozy-primary/10 rounded-full flex items-center justify-center text-xs text-cozy-primary">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="mt-auto pt-4 text-xs text-cozy-muted italic w-full text-center">Click to reveal answer</p>
              </div>

              {/* Answer Side */}
              <div className="absolute inset-0 backface-hidden bg-cozy-primary rounded-[2.5rem] p-8 md:p-12 flex flex-col items-start justify-center text-left shadow-xl border border-cozy-primary rotate-y-180 text-white overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-4">Answer</span>
                <p className="text-lg md:text-xl font-medium leading-relaxed">{card.answer}</p>
                <p className="mt-auto pt-4 text-xs opacity-70 italic w-full text-center">Click to flip back</p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={prevCard}
          disabled={currentIndex === 0}
          className="p-4 bg-cozy-card rounded-full shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
        <button 
          onClick={nextCard}
          disabled={currentIndex === cards.length - 1}
          className="p-4 bg-cozy-card rounded-full shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-colors"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
};

export default StudyVisualizer;
