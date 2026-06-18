/**
 * Landing Page — welcome screen with Continue/Start options using pixel art assets
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
        backgroundImage: 'url(/cdn-assets/landing-bg.png)',
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
      {/* Subtle overlay for readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.15)',
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
          gap: 'clamp(30px, 8vw, 60px)',
          maxWidth: '95vw',
          width: '100%',
        }}
      >
        {/* Title Image */}
        <img
          src="/cdn-assets/game-title.png"
          alt="The Quiet Garden"
          style={{
            maxWidth: 'clamp(200px, 80vw, 500px)',
            height: 'auto',
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
          }}
        />

        {/* Buttons Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(15px, 5vw, 25px)',
            alignItems: 'center',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          {/* Continue Button (only if save exists) */}
          {saveExists && (
            <button
              onClick={handleContinue}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                maxWidth: '100%',
                transition: 'transform 0.15s ease, filter 0.15s ease',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))';
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <img
                src="/cdn-assets/btn-continue.png"
                alt="Continue"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
            </button>
          )}

          {/* Start/New Game Button */}
          <button
            onClick={handleNewGame}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              maxWidth: '100%',
              transition: 'transform 0.15s ease, filter 0.15s ease',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.filter = 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src="/cdn-assets/btn-start.png"
              alt={saveExists ? 'New Game' : 'Start'}
              style={{
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </button>
        </div>
      </div>

      {/* New Game Confirmation Dialog */}
      {showNewGameConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
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
              border: '4px solid #D4AF37',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '90vw',
              width: '350px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h2
              style={{
                fontSize: '24px',
                margin: '0 0 15px 0',
                color: '#D4AF37',
                fontFamily: 'Georgia, serif',
              }}
            >
              Start New Game?
            </h2>
            <p
              style={{
                fontSize: '14px',
                margin: '0 0 25px 0',
                opacity: 0.85,
                lineHeight: '1.4',
              }}
            >
              Your progress will be lost. Are you sure?
            </p>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setShowNewGameConfirm(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  backgroundColor: '#8B7355',
                  color: '#fff',
                  border: '2px solid #5D4E37',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#A0826D';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#8B7355';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmNewGame}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  backgroundColor: '#D4AF37',
                  color: '#2C1810',
                  border: '2px solid #8B7355',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFD700';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#D4AF37';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
