import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState } from 'react';

interface AuthDialogProps {
  onSuccess: (username: string) => void;
  trigger?: React.ReactNode;
}

export const AuthDialog = ({ onSuccess, trigger }: AuthDialogProps) => {
  const [username, setUsername] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSuccess(username);
      setIsOpen(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="bg-cozy-primary text-white px-6 py-2 rounded-full font-medium hover:bg-cozy-primary/90 transition-colors">
            Get Started
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-cozy-card p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 focus:outline-none border border-cozy-secondary/10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Dialog.Title className="text-2xl font-bold text-cozy-text">Welcome to StudyVisual</Dialog.Title>
              <Dialog.Description className="text-cozy-muted mt-2">
                Enter a username to start saving your progress.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-cozy-accent rounded-full transition-colors text-cozy-muted" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold mb-2 text-cozy-text">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. studious_owl"
                className="w-full px-4 py-3 rounded-xl border border-cozy-secondary/30 bg-cozy-accent/30 focus:border-cozy-primary focus:ring-2 focus:ring-cozy-primary/20 outline-none transition-all text-cozy-text"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-cozy-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-cozy-primary/90 transition-all shadow-lg hover:shadow-cozy-primary/20"
            >
              Continue Studying
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
