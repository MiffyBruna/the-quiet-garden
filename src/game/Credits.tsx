/**
 * Credits Screen — Shows contributors with rain/sparkles background.
 * After credits finish scrolling, triggers "add your name" prompt.
 */
import { useState, useEffect, useRef } from 'react';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';
import type { Credit } from '../services/credits';

// Re-export for convenience
export type { Credit };

interface CreditsProps {
  credits: Credit[];
  onCreditsFinished: () => void;
}

export function Credits({ credits, onCreditsFinished }: CreditsProps) {
  const safeArea = getSafeArea();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(20); // pixels per second
  const [finished, setFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(Date.now());

  // Rain effect
  const raindrops = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
    opacity: Math.random() * 0.6 + 0.2,
  }));

  // Sparkles
  const sparkles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 3,
  }));

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

      {/* Sparkles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            style={{
              position: 'absolute',
              left: `${sparkle.left}%`,
              top: `${sparkle.top}%`,
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.8)',
              boxShadow: '0 0 6px rgba(255,255,255,0.8)',
              animation: `sparkle 2s ease-in-out ${sparkle.delay}s infinite`,
            }}
          />
        ))}
        <style>{`
          @keyframes sparkle {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>

      {/* Header */}
      <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: '#fff', zIndex: 10 }}>
        <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
          ✨ Credits ✨
        </div>
        <div style={{ fontSize: 14, opacity: 0.8, marginBottom: theme.spacing.md }}>
          {credits.length} gardeners helped grow this valley
        </div>

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
          <div style={{ color: '#fff', fontSize: 12, minWidth: 60, textAlign: 'center' }}>
            {scrollSpeed}px/s
          </div>
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
          {/* Title */}
          <div style={{ textAlign: 'center', color: '#fff', paddingBottom: theme.spacing.xl }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: theme.spacing.md }}>
              The Quiet Garden
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              A collaboration by gardeners from around the world
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
