/**
 * Landing Page — welcome screen with Continue/Start options using pixel art assets
 */
import { useState, useEffect } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

interface LandingPageProps {
  onStart: (isContinue: boolean) => void;
}

interface Sparkle {
  id: number;
  left: number;
  delay: number;
  duration: number;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [saveExists, setSaveExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

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

  // Generate sparkles on mount and periodically
  useEffect(() => {
    const generateSparkles = () => {
      const newSparkles: Sparkle[] = [];
      for (let i = 0; i < 150; i++) {
        newSparkles.push({
          id: Math.random(),
          left: Math.random() * 100,
          delay: Math.random() * 2.5,
          duration: 2.5 + Math.random() * 1.5,
        });
      }
      setSparkles(newSparkles);
    };

    generateSparkles();
    const interval = setInterval(generateSparkles, 2500);
    return () => clearInterval(interval);
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

      {/* Sparkle Rain Animation */}
      <style>{`
        @keyframes sparkleRain {
          0% {
            transform: translateY(-100vh) scale(1);
            opacity: 0;
          }
          3% {
            opacity: 1;
          }
          97% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) scale(0.2);
            opacity: 0;
          }
        }
        .sparkle-particle {
          position: absolute;
          top: 0;
          width: 3px;
          height: 3px;
          background: radial-gradient(circle, #FFF9E6 0%, #FFE6B0 50%, #FFD700 100%);
          border-radius: 50%;
          filter: drop-shadow(0 0 3px #FFD700) drop-shadow(0 0 1px #FFED4E);
          animation: sparkleRain linear forwards;
          pointer-events: none;
          box-shadow: 0 0 4px #FFD700;
        }
      `}</style>

      {/* Sparkle container with clip to hide top accumulation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: 'inset(8% 0 0 0)',
          pointerEvents: 'none',
        }}
      >
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            className="sparkle-particle"
            style={{
              left: `${sparkle.left}%`,
              animation: `sparkleRain ${sparkle.duration}s linear ${sparkle.delay}s forwards`,
            }}
          />
        ))}
      </div>

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
            maxWidth: 'clamp(250px, 85vw, 650px)',
            height: 'auto',
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
            marginBottom: '10px',
          }}
        />

        {/* Buttons Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(12px, 3vw, 18px)',
            alignItems: 'center',
            width: '100%',
            maxWidth: '300px',
          }}
        >
          {/* Start/New Game Button */}
          <button
            onClick={handleNewGame}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              maxWidth: 'clamp(150px, 50vw, 250px)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease',
              filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.filter = 'drop-shadow(0 6px 12px rgba(255, 215, 0, 0.4))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src="/cdn-assets/btn-start.png"
              alt={saveExists ? 'New Game' : 'Start'}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </button>

          {/* Continue Button (text-based, only if save exists) */}
          {saveExists && (
            <button
              onClick={handleContinue}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 20px',
                fontSize: 'clamp(11px, 3vw, 13px)',
                fontWeight: 'bold',
                color: '#D4AF37',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.textShadow = '0 0 8px rgba(255, 215, 0, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.textShadow = 'none';
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Continue
            </button>
          )}
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
                margin: '0 0 10px 0',
                opacity: 0.85,
                lineHeight: '1.5',
              }}
            >
              ⚠️ Your previous saved game will be <strong>permanently overwritten</strong> and cannot be recovered.
            </p>
            <p
              style={{
                fontSize: '12px',
                margin: '0 0 25px 0',
                opacity: 0.7,
                lineHeight: '1.4',
              }}
            >
              Are you sure you want to continue?
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
