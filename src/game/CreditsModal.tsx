/**
 * CreditsModal — Post-credits prompt to add player to credits with their RUN.game username
 * Flow: Watch ad → Add username (auto) → Success
 */
import { useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';
import { addCredit } from '../services/credits';

interface CreditsModalProps {
  onNameAdded: (name: string) => void;
  onClose: () => void;
}

type Stage = 'prompt' | 'watching-ad' | 'adding' | 'success' | 'error';

export function CreditsModal({ onNameAdded, onClose }: CreditsModalProps) {
  const safeArea = getSafeArea();
  const [stage, setStage] = useState<Stage>('prompt');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingAd, setIsCheckingAd] = useState(false);
  const [creditName, setCreditName] = useState('');

  // Get player's username, fallback to GentleAnonymous
  const getPlayerName = (): string => {
    try {
      const profile = RundotGameAPI.getProfile();
      if (profile.username && !profile.isAnonymous) {
        return profile.username;
      }
    } catch (error) {
      console.error('Failed to get profile:', error);
    }
    // Fallback for anonymous players
    return 'GentleAnonymous';
  };

  // Check if rewarded ad is ready and show it
  const handleWatchAd = async () => {
    setIsCheckingAd(true);
    try {
      const isReady = await RundotGameAPI.ads.isRewardedAdReadyAsync();
      if (!isReady) {
        setErrorMessage('No ad available right now. Try again later!');
        setStage('error');
        setIsCheckingAd(false);
        return;
      }

      setStage('watching-ad');
      const watched = await RundotGameAPI.ads.showRewardedAdAsync();

      if (watched) {
        // Ad watched successfully, now add the player to credits
        await handleAddToCredits();
        RundotGameAPI.analytics.recordCustomEvent('credits_ad_watched');
      } else {
        setErrorMessage('Ad was skipped. Please watch the full ad.');
        setStage('error');
      }
    } catch (error) {
      console.error('Ad error:', error);
      setErrorMessage('Ad failed to load. Try again later.');
      setStage('error');
    }
    setIsCheckingAd(false);
  };

  // Add player to credits using their username
  const handleAddToCredits = async () => {
    setStage('adding');
    const name = getPlayerName();
    setCreditName(name);

    try {
      // Small delay for better UX (shows "adding" stage briefly)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Save to credits storage
      addCredit(name);

      setStage('success');
      RundotGameAPI.analytics.recordCustomEvent('credits_name_added', {
        name: name,
      });

      // Callback with name
      onNameAdded(name);

      // Auto-close after 2 seconds
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Error adding to credits:', error);
      setErrorMessage('Failed to add you to credits. Try again!');
      setStage('error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
      }}
    >
      {/* Modal */}
      <div
        style={{
          background: 'linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%)',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          maxWidth: 400,
          width: '90%',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* PROMPT STAGE */}
        {stage === 'prompt' && (
          <>
            <div style={{ color: '#fff', textAlign: 'center', marginBottom: theme.spacing.lg }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
                ✨ Join the Garden ✨
              </div>
              <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.6 }}>
                Watch a short ad to add your name to the <strong>Recent Contributors</strong> (top 50) and become part of this garden's story.
              </div>
            </div>

            <button
              onClick={handleWatchAd}
              disabled={isCheckingAd}
              style={{
                width: '100%',
                padding: `${theme.spacing.md}px`,
                background: isCheckingAd
                  ? 'rgba(100,149,237,0.5)'
                  : 'linear-gradient(135deg, #6495ed, #4169e1)',
                color: '#fff',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: isCheckingAd ? 'not-allowed' : 'pointer',
                marginBottom: theme.spacing.md,
                transition: 'all 0.3s',
              }}
              onMouseOver={(e) => {
                if (!isCheckingAd) e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isCheckingAd ? '⏳ Checking...' : '▶ Watch Ad (15s)'}
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: `${theme.spacing.sm}px`,
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: theme.borderRadius.md,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </>
        )}

        {/* WATCHING AD STAGE */}
        {stage === 'watching-ad' && (
          <>
            <div style={{ color: '#fff', textAlign: 'center', marginBottom: theme.spacing.lg }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
                🎬 Playing Ad...
              </div>
              <div style={{ opacity: 0.7 }}>Please wait for the ad to finish</div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: `${theme.spacing.sm}px`,
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: theme.borderRadius.md,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </>
        )}

        {/* ADDING STAGE */}
        {stage === 'adding' && (
          <div style={{ color: '#fff', textAlign: 'center', padding: theme.spacing.lg }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              ✓ Adding you...
            </div>
            <div style={{ opacity: 0.7 }}>Welcome to the garden</div>
          </div>
        )}

        {/* SUCCESS STAGE */}
        {stage === 'success' && (
          <div style={{ color: '#fff', textAlign: 'center', padding: theme.spacing.lg }}>
            <div style={{ fontSize: 28, marginBottom: theme.spacing.md }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              Welcome to the Credits!
            </div>
            <div style={{ opacity: 0.8 }}>
              "{creditName}" has been added to the garden's story.
            </div>
          </div>
        )}

        {/* ERROR STAGE */}
        {stage === 'error' && (
          <>
            <div style={{ color: '#ff6b6b', textAlign: 'center', marginBottom: theme.spacing.lg }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
                ⚠ {errorMessage}
              </div>
            </div>

            <button
              onClick={() => setStage('prompt')}
              style={{
                width: '100%',
                padding: `${theme.spacing.md}px`,
                background: 'rgba(100,149,237,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                fontSize: 14,
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: theme.spacing.sm,
              }}
            >
              Try Again
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: `${theme.spacing.sm}px`,
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: theme.borderRadius.md,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
