/**
 * CreditsModal — Post-credits prompt to add player name
 * Flow: Watch ad → Input name → Moderate with Perspective API → Save
 */
import { useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';

interface CreditsModalProps {
  onNameAdded: (name: string) => void;
  onClose: () => void;
}

type Stage = 'prompt' | 'watching-ad' | 'input' | 'submitting' | 'success' | 'error';

export function CreditsModal({ onNameAdded, onClose }: CreditsModalProps) {
  const safeArea = getSafeArea();
  const [stage, setStage] = useState<Stage>('prompt');
  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingAd, setIsCheckingAd] = useState(false);

  const MAX_NAME_LENGTH = 30;
  const PERSPECTIVE_API_KEY = 'AIzaSyAK8yq5O-vWJVez96eHYESLI-bn0nBAI84'; // Free API key (rate limited)

  // Check if rewarded ad is ready
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
        setStage('input');
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

  // Check name with Perspective API
  const checkNameModeration = async (name: string): Promise<boolean> => {
    try {
      const response = await fetch(
        'https://commentanalyzerapi.googleapis.com/v1/comments:analyzeComment?key=' +
          PERSPECTIVE_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text: name },
            languages: ['en'],
            requestedAttributes: { TOXICITY: {} },
          }),
        }
      );

      if (!response.ok) {
        // Fallback: if API fails, allow the name (better UX)
        return true;
      }

      const data = await response.json();
      const toxicityScore = data.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;

      // Allow if toxicity < 0.5
      return toxicityScore < 0.5;
    } catch (error) {
      console.error('Moderation error:', error);
      // Fallback: allow on error
      return true;
    }
  };

  const handleSubmitName = async () => {
    const trimmedName = playerName.trim();

    // Validation
    if (!trimmedName) {
      setErrorMessage('Please enter a name');
      return;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      setErrorMessage(`Name is too long (max ${MAX_NAME_LENGTH} characters)`);
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('Name is too short (min 2 characters)');
      return;
    }

    setStage('submitting');

    // Check moderation
    const isClean = await checkNameModeration(trimmedName);

    if (!isClean) {
      setErrorMessage('Name contains inappropriate content. Please try another name.');
      setStage('input');
      return;
    }

    setStage('success');
    RundotGameAPI.analytics.recordCustomEvent('credits_name_added', {
      nameLength: trimmedName.length,
    });

    // Callback with name
    onNameAdded(trimmedName);

    // Auto-close after 2 seconds
    setTimeout(onClose, 2000);
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
                ✨ Add Your Name ✨
              </div>
              <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.6 }}>
                Watch a short ad to add your name to the credits and become part of this garden's story.
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
          <div style={{ color: '#fff', textAlign: 'center', padding: theme.spacing.lg }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              🎬 Playing Ad...
            </div>
            <div style={{ opacity: 0.7 }}>Please wait for the ad to finish</div>
          </div>
        )}

        {/* INPUT STAGE */}
        {stage === 'input' && (
          <>
            <div style={{ color: '#fff', marginBottom: theme.spacing.lg }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: theme.spacing.sm }}>
                What's your name?
              </div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value.slice(0, MAX_NAME_LENGTH));
                  setErrorMessage('');
                }}
                placeholder="Enter your name..."
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                style={{
                  width: '100%',
                  padding: `${theme.spacing.sm}px`,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: theme.borderRadius.sm,
                  color: '#fff',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  marginBottom: theme.spacing.md,
                }}
              />
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {playerName.length}/{MAX_NAME_LENGTH}
              </div>
            </div>

            {errorMessage && (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: theme.spacing.md }}>
                ⚠ {errorMessage}
              </div>
            )}

            <button
              onClick={handleSubmitName}
              disabled={!playerName.trim()}
              style={{
                width: '100%',
                padding: `${theme.spacing.md}px`,
                background: playerName.trim()
                  ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                  : 'rgba(82,196,26,0.3)',
                color: '#fff',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                fontSize: 16,
                fontWeight: 'bold',
                cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                marginBottom: theme.spacing.sm,
              }}
            >
              Add to Credits
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
              Skip
            </button>
          </>
        )}

        {/* SUBMITTING STAGE */}
        {stage === 'submitting' && (
          <div style={{ color: '#fff', textAlign: 'center', padding: theme.spacing.lg }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              ✓ Checking...
            </div>
            <div style={{ opacity: 0.7 }}>Verifying your name</div>
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
              "{playerName}" has been added to the garden's story.
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
