'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    tradingStyle: '',
    interests: [] as string[],
  });

  const interests = ['Jerseys', 'Discs', 'Apparel', 'Collectibles', 'Rare Items', 'Vintage'];

  const handleInterestToggle = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      router.push('/app');
    }
  };

  const handleSkip = () => {
    router.push('/app');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-accent' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Poachland</h1>
              <p className="text-secondary-foreground">
                The ultimate marketplace for disc and jersey collectors.
              </p>
            </div>
            <div className="space-y-3 text-sm text-secondary-foreground">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-accent font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-foreground">Browse Collections</p>
                  <p>Discover rare jerseys and discs from collectors worldwide</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-accent font-bold">
                  2
                </div>
                <div>
                  <p className="font-semibold text-foreground">Trade & Sell</p>
                  <p>List items or propose trades with the community</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-accent font-bold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-foreground">Trusted Network</p>
                  <p>Build reputation and connect with verified traders</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Profile */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Create Your Profile</h2>
              <p className="text-secondary-foreground">
                Help other collectors get to know you.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Username</label>
                <input
                  type="text"
                  placeholder="Choose a collector name"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
                <textarea
                  placeholder="Tell us about yourself and your collections"
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Trading Preferences */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Trading Style</h2>
              <p className="text-secondary-foreground">
                How do you prefer to trade?
              </p>
            </div>
            <div className="space-y-3">
              {['Buy & Sell', 'Trade Only', 'Looking to Trade Up', 'Selling Collection'].map(style => (
                <button
                  key={style}
                  onClick={() => setFormData({ ...formData, tradingStyle: style })}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left font-medium ${
                    formData.tradingStyle === style
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'border-border bg-secondary text-secondary-foreground hover:border-accent/50'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Interests */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">What Interests You?</h2>
              <p className="text-secondary-foreground">
                We'll personalize your feed based on these interests.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {interests.map(interest => (
                <button
                  key={interest}
                  onClick={() => handleInterestToggle(interest)}
                  className={`p-3 rounded-lg border-2 transition-all font-medium text-sm ${
                    formData.interests.includes(interest)
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'border-border bg-secondary text-secondary-foreground hover:border-accent/50'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-4 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent/90 transition-colors"
          >
            {step === 4 ? 'Get Started' : 'Next'}
          </button>
        </div>
        {step === 1 && (
          <button
            onClick={handleSkip}
            className="w-full mt-2 px-4 py-2 text-secondary-foreground hover:text-foreground transition-colors text-sm"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
