/**
 * Landing Page — welcome screen with Continue/Start options
 */
import { useState, useEffect } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

interface LandingPageProps {
  onStart: (isContinue: boolean) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [saveExists, setSaveExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const save = await RundotGameAPI.appStorage.getItem('quiet-garden-save');
        setSaveExists(!!save);
      } catch (e) {
        console.warn('Failed to check for save:', e);
        setSaveExists(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleContinue = () => {
    RundotGameAPI.analytics.recordCustomEvent('landing_continue_clicked');
    onStart(true);
  };

  const handleNewGame = () => {
    if (saveExists) {
      RundotGameAPI.analytics.recordCustomEvent('landing_newgame_confirm_shown');
      setShowNewGameConfirm(true);
    } else {
      RundotGameAPI.analytics.recordCustomEvent('landing_start_clicked');
      onStart(false);
    }
  };

  const confirmNewGame = () => {
    RundotGameAPI.analytics.recordCustomEvent('landing_newgame_confirmed');
    // Clear the save
    RundotGameAPI.appStorage.removeItem('quiet-garden-save');
    onStart(false);
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '18px',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundImage: 'url(/cdn-assets/landing-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Overlay for better text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '40px',
          maxWidth: '500px',
          width: '100%',
        }}
      >
        {/* Title */}
        <div
          style={{
            textAlign: 'center',
            color: '#fff',
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.7)',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(28px, 8vw, 48px)',
              margin: '0 0 10px 0',
              fontWeight: 'bold',
              letterSpacing: '2px',
            }}
          >
            The Quiet Garden
          </h1>
          <p
            style={{
              fontSize: 'clamp(12px, 4vw, 16px)',
              margin: 0,
              opacity: 0.9,
              fontStyle: 'italic',
            }}
          >
            Restore a forgotten watershed
          </p>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
            alignItems: 'stretch',
          }}
        >
          {/* Continue Button (only if save exists) */}
          {saveExists && (
            <button
              onClick={handleContinue}
              style={{
                padding: '16px 32px',
                fontSize: 'clamp(14px, 4vw, 20px)',
                fontWeight: 'bold',
                backgroundColor: '#8B7355',
                color: '#fff',
                border: '3px solid #5D4E37',
                borderRadius: '8px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#A0826D';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#8B7355';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}
            >
              Continue
            </button>
          )}

          {/* Start/New Game Button */}
          <button
            onClick={handleNewGame}
            style={{
              padding: '16px 32px',
              fontSize: 'clamp(14px, 4vw, 20px)',
              fontWeight: 'bold',
              backgroundColor: '#D4AF37',
              color: '#2C1810',
              border: '3px solid #8B7355',
              borderRadius: '8px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FFD700';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#D4AF37';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
          >
            {saveExists ? 'New Game' : 'Start'}
          </button>
        </div>
      </div>

      {/* New Game Confirmation Dialog */}
      {showNewGameConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#2C1810',
              border: '3px solid #D4AF37',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '400px',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <h2
              style={{
                fontSize: '24px',
                margin: '0 0 20px 0',
                color: '#D4AF37',
              }}
            >
              Start New Game?
            </h2>
            <p
              style={{
                fontSize: '16px',
                margin: '0 0 30px 0',
                opacity: 0.9,
              }}
            >
              Your progress will be lost. Are you sure?
            </p>
            <div
              style={{
                display: 'flex',
                gap: '15px',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setShowNewGameConfirm(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#8B7355',
                  color: '#fff',
                  border: '2px solid #5D4E37',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#A0826D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#8B7355';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmNewGame}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#D4AF37',
                  color: '#2C1810',
                  border: '2px solid #8B7355',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#D4AF37';
                }}
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
