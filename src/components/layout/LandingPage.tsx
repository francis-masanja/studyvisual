import React, { useEffect, useState } from 'react';
import { BookOpen, Upload, Shield, Zap, Smartphone, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuthDialog } from '../ui/AuthDialog';
import { useUser } from '../../hooks/useUser';

const LandingPage = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { login } = useUser();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-cozy-bg text-cozy-text flex flex-col">
      <header className="p-6 flex justify-between items-center border-b border-cozy-secondary/20">
        <div className="flex items-center gap-2">
          <BookOpen className="text-cozy-primary w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight">StudyVisual</h1>
        </div>
        <AuthDialog onSuccess={login} />
      </header>

      <main className="flex-1">
        {isMobile ? <MobileHero onGetStarted={login} /> : <DesktopHero onGetStarted={login} />}
        
        <section className="py-20 px-6 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Upload className="w-8 h-8 text-cozy-primary" />}
              title="Upload Materials"
              description="Drop your .md or .json files. We handle the formatting for you."
            />
            <FeatureCard 
              icon={<Zap className="w-8 h-8 text-cozy-primary" />}
              title="Instant Visualization"
              description="See your notes transformed into a beautiful, readable layout."
            />
            <FeatureCard 
              icon={<Shield className="w-8 h-8 text-cozy-primary" />}
              title="Track Progress"
              description="Save your materials to Turso and keep track of your study streak."
            />
          </div>
        </section>
      </main>

      <footer className="p-10 bg-cozy-secondary/10 border-t border-cozy-secondary/20 text-center text-cozy-muted">
        <p>© 2026 StudyVisual. All rights reserved.</p>
      </footer>
    </div>
  );
};

const DesktopHero = ({ onGetStarted }: { onGetStarted: (user: string) => void }) => (
  <section className="py-24 px-6 flex flex-col items-center text-center max-w-4xl mx-auto">
    <div className="bg-cozy-accent px-4 py-1 rounded-full text-sm font-medium mb-6 flex items-center gap-2">
      <Monitor className="w-4 h-4" /> Optimized for Desktop
    </div>
    <h2 className="text-6xl font-extrabold mb-6 leading-tight">
      Transform your notes into <span className="text-cozy-primary italic">visual masterpieces</span>.
    </h2>
    <p className="text-xl text-cozy-muted mb-10 max-w-2xl">
      The cozy study companion for students. Upload, visualize, and conquer your materials with ease.
    </p>
    <div className="flex gap-4">
      <AuthDialog 
        onSuccess={onGetStarted} 
        trigger={
          <button className="bg-cozy-primary text-white px-8 py-3 rounded-lg text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
            Try it now
          </button>
        } 
      />
      <button className="bg-white border border-cozy-secondary text-cozy-text px-8 py-3 rounded-lg text-lg font-semibold hover:bg-cozy-accent transition-all">
        View Demo
      </button>
    </div>
  </section>
);

const MobileHero = ({ onGetStarted }: { onGetStarted: (user: string) => void }) => (
  <section className="py-16 px-6 flex flex-col items-center text-center">
    <div className="bg-cozy-accent px-4 py-1 rounded-full text-sm font-medium mb-6 flex items-center gap-2">
      <Smartphone className="w-4 h-4" /> Seamless Mobile Experience
    </div>
    <h2 className="text-4xl font-extrabold mb-6 leading-tight">
      Study <span className="text-cozy-primary italic">anywhere</span>, beautifully.
    </h2>
    <p className="text-lg text-cozy-muted mb-8">
      Your notes, visual and accessible on the go.
    </p>
    <AuthDialog 
      onSuccess={onGetStarted} 
      trigger={
        <button className="w-full bg-cozy-primary text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg">
          Get Started
        </button>
      } 
    />
  </section>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 bg-white rounded-2xl border border-cozy-secondary/20 shadow-sm hover:shadow-md transition-shadow">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-cozy-muted leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
