import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Layers, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { StudyMaterial, StudyDocument, StudyFlashcards } from '../../lib/parser';

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

  if (isLoading) return <div className="min-h-screen bg-cozy-bg flex items-center justify-center">Loading...</div>;
  if (!material) return <div className="min-h-screen bg-cozy-bg flex items-center justify-center">Material not found.</div>;

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex flex-col">
      <header className="p-4 border-b border-cozy-secondary/20 bg-white flex justify-between items-center sticky top-0 z-10">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-cozy-muted hover:text-cozy-text transition-colors"
        >
          <ArrowLeft size={20} /> Back to Library
        </button>
        <h1 className="font-bold text-lg truncate max-w-xs">{material.title}</h1>
        <div className="w-24" /> {/* Spacer */}
      </header>

      <main className="flex-1 flex flex-col">
        {material.type === 'document' ? (
          <DocumentView material={material} />
        ) : (
          <FlashcardView material={material} />
        )}
      </main>
    </div>
  );
};

const DocumentView = ({ material }: { material: StudyDocument }) => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6 space-y-12">
      {material.sections.map((section, idx) => (
        <motion.section 
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-cozy-secondary/10"
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
      <div className="py-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold">You've finished this document!</h3>
        <p className="text-cozy-muted mt-2">Great job. Your progress has been saved.</p>
      </div>
    </div>
  );
};

const FlashcardView = ({ material }: { material: StudyFlashcards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const nextCard = () => {
    if (currentIndex < material.cards.length - 1) {
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

  const card = material.cards[currentIndex];
  const progress = ((currentIndex + 1) / material.cards.length) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span>Card {currentIndex + 1} of {material.cards.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-cozy-accent h-2 rounded-full overflow-hidden">
          <div 
            className="bg-cozy-primary h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative w-full max-w-lg aspect-[4/3] perspective-1000">
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
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center shadow-xl border border-cozy-secondary/20">
                <span className="text-xs font-bold uppercase tracking-widest text-cozy-muted mb-4">Question</span>
                <p className="text-3xl font-bold leading-tight">{card.question}</p>
                <p className="mt-8 text-sm text-cozy-muted italic">Click to reveal answer</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-cozy-primary rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center shadow-xl border border-cozy-primary rotate-y-180 text-white">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-4">Answer</span>
                <p className="text-2xl font-medium leading-relaxed">{card.answer}</p>
                <p className="mt-8 text-sm opacity-70 italic">Click to flip back</p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={prevCard}
          disabled={currentIndex === 0}
          className="p-4 bg-white rounded-full shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
        <button 
          onClick={nextCard}
          disabled={currentIndex === material.cards.length - 1}
          className="p-4 bg-white rounded-full shadow-md disabled:opacity-30 hover:bg-cozy-accent transition-colors"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
};

export default StudyVisualizer;
