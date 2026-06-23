/**
 * Credits Screen — Shows contributors with rain/sparkles background.
 * After credits finish scrolling, triggers "add your name" prompt.
 */
import { useState, useEffect, useRef } from 'react';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';
import type { Credit } from '../services/credits';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

// Re-export for convenience
export type { Credit };

// Telemetry: Record when credits are accessed
RundotGameAPI.analytics.recordCustomEvent('credits_opened');

interface CreditsProps {
  credits: Credit[];
  onCreditsFinished: () => void;
  onClose?: () => void;
}

export function Credits({ credits, onCreditsFinished, onClose }: CreditsProps) {
  const safeArea = getSafeArea();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(20); // pixels per second
  const [finished, setFinished] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(Date.now());
  const creditsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Rain effect
  const raindrops = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
    opacity: Math.random() * 0.6 + 0.2,
  }));

  // Load logo from CDN
  useEffect(() => {
    (async () => {
      try {
        const blob = await RundotGameAPI.cdn.fetchAsset('logo.png');
        const url = URL.createObjectURL(blob);
        setLogoUrl(url);
      } catch (error) {
        console.warn('Failed to load logo:', error);
      }
    })();
  }, []);

  // Start credits music on mount (stop all other audio first)
  useEffect(() => {
    const playCreditsMusic = async () => {
      try {
        // Get the audio manager functions
        const { unlockAudio, stopRain, stopMusic } = await import('./services/audioManager');

        // Stop background music and rain
        stopRain();
        stopMusic();

        creditsAudioRef.current = new Audio('/credits-music.mp3');
        creditsAudioRef.current.loop = true;
        creditsAudioRef.current.volume = 0.6;

        // Try to play with unlock fallback
        creditsAudioRef.current.play().catch((err: any) => {
          if (err?.name === 'NotAllowedError') {
            unlockAudio();
            setTimeout(() => {
              creditsAudioRef.current?.play().catch((e) => {
                console.warn('Failed to play credits music after unlock:', e);
              });
            }, 100);
          } else {
            console.warn('Failed to play credits music:', err);
          }
        });
      } catch (error) {
        console.warn('Failed to initialize credits music:', error);
      }
    };

    playCreditsMusic();

    return () => {
      if (creditsAudioRef.current) {
        creditsAudioRef.current.pause();
        creditsAudioRef.current = null;
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = now;

      setScrollPosition((prev) => {
        const newPos = prev + scrollSpeed * deltaTime;

        // Check if finished
        if (contentRef.current && containerRef.current) {
          const contentHeight = contentRef.current.offsetHeight;
          const containerHeight = containerRef.current.offsetHeight;
          if (newPos >= contentHeight + containerHeight) {
            setFinished(true);
            return newPos;
          }
        }

        return newPos;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [scrollSpeed]);

  // Trigger callback when finished
  useEffect(() => {
    if (finished) {
      setTimeout(() => onCreditsFinished(), 1000);
    }
  }, [finished, onCreditsFinished]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        zIndex: 200,
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Rain effect */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3 }}>
        {raindrops.map((drop) => (
          <div
            key={drop.id}
            style={{
              position: 'absolute',
              left: `${drop.left}%`,
              top: 0,
              width: '2px',
              height: '20px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.8), transparent)',
              animation: `rain ${drop.duration}s linear ${drop.delay}s infinite`,
              opacity: drop.opacity,
            }}
          />
        ))}
        <style>{`
          @keyframes rain {
            to { transform: translateY(100vh); }
          }
        `}</style>
      </div>

      {/* Sparkles disabled */}

      {/* Header — Speed controls + Close button */}
      <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: '#fff', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Speed control */}
        <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={() => setScrollSpeed(Math.max(10, scrollSpeed - 10))}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff',
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            − Slow
          </button>
          <button
            onClick={() => setScrollSpeed(Math.min(60, scrollSpeed + 10))}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff',
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            + Fast
          </button>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff',
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Credits scroll container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translateY(-${scrollPosition}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.lg,
            paddingTop: '100vh',
            paddingBottom: '100vh',
          }}
        >
          {/* Gardeners count */}
          <div style={{ textAlign: 'center', color: '#fff', paddingBottom: theme.spacing.xl }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              {credits.length} gardeners shaping this valley
            </div>
          </div>

          {/* Title with Logo */}
          <div style={{ textAlign: 'center', color: '#fff', paddingBottom: theme.spacing.xl }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="The Quiet Garden"
                style={{ maxWidth: '200px', height: 'auto', marginBottom: theme.spacing.md }}
              />
            ) : (
              <div style={{ maxWidth: '200px', height: 'auto', marginBottom: theme.spacing.md, opacity: 0.5 }}>
                Loading...
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              A collaboration by gardeners from around the world
            </div>
          </div>

          {/* Game Credits */}
          <div style={{ textAlign: 'center', color: '#fff', paddingBottom: theme.spacing.xl, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: theme.spacing.xl }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: theme.spacing.md, color: '#A8E6A8' }}>
              Game
            </div>
            <div style={{ fontSize: 14, marginBottom: theme.spacing.lg }}>Created by GENTLECATBYTES</div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: theme.spacing.sm, color: '#A8E6A8' }}>
              Music
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: theme.spacing.xs }}>
              Clay pots and rain
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: theme.spacing.md }}>
              Puddles at Golden Hour
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: theme.spacing.lg }}>
              Created with Lyria AI v3
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: theme.spacing.sm, color: '#A8E6A8' }}>
              Sound Effects
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              kenney.nl/assets
            </div>
          </div>

          {/* Player Contributors Header */}
          <div style={{ textAlign: 'center', color: '#fff', marginBottom: theme.spacing.lg }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#A8E6A8' }}>
              Recent Contributors
            </div>
          </div>

          {/* Credits list */}
          {credits.map((credit, idx) => (
            <div
              key={idx}
              style={{
                textAlign: 'center',
                color: '#fff',
                padding: `${theme.spacing.md}px 0`,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600 }}>{credit.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: theme.spacing.xs }}>
                {formatDate(credit.date)}
              </div>
            </div>
          ))}

          {/* End message */}
          <div style={{ textAlign: 'center', color: '#fff', paddingTop: theme.spacing.xl }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              🌱 Thank You 🌱
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Your contributions have made this garden grow.
            </div>
          </div>
        </div>
      </div>

      {/* Finished overlay */}
      {finished && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{ color: '#fff', textAlign: 'center', fontSize: 18 }}>
            Loading next...
          </div>
        </div>
      )}
    </div>
  );
}
