/**
 * LoadingScreen — animated loading screen with rain, dancing bar, and flying bee
 */
import { useEffect, useState } from 'react';

export function LoadingScreen() {
  const [beeX, setBeeX] = useState(0);

  useEffect(() => {
    // Animate bee position
    const interval = setInterval(() => {
      setBeeX((prev) => (prev > 120 ? 0 : prev + 1));
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes rainDrop {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }

        @keyframes danceBar {
          0%, 100% { transform: scaleY(1); }
          25% { transform: scaleY(1.15); }
          50% { transform: scaleY(0.85); }
          75% { transform: scaleY(1.15); }
        }

        @keyframes flyBee {
          0% { transform: translateY(-20px) rotate(0deg); }
          25% { transform: translateY(-30px) rotate(10deg); }
          50% { transform: translateY(-25px) rotate(0deg); }
          75% { transform: translateY(-35px) rotate(-10deg); }
          100% { transform: translateY(-20px) rotate(0deg); }
        }

        .rain-drop {
          position: absolute;
          width: 2px;
          height: 20px;
          background: linear-gradient(to bottom, rgba(100,200,255,0.8), rgba(100,200,255,0));
          opacity: 0;
        }

        .loading-bar-container {
          position: relative;
          width: 240px;
          height: 24px;
          background: rgba(255, 255, 255, 0.3);
          border: 2px solid rgba(124, 202, 124, 0.6);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .loading-bar-fill {
          width: 65%;
          height: 100%;
          background: linear-gradient(90deg, #7CCA7C, #9AE6A0);
          border-radius: 10px;
          animation: danceBar 1.2s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(124, 202, 124, 0.6);
        }

        .bee-container {
          position: absolute;
          left: 0;
          top: -60px;
          width: 100vw;
          height: 100px;
          pointer-events: none;
        }

        .bee-sprite {
          position: absolute;
          font-size: 32px;
          animation: flyBee 2s ease-in-out infinite;
        }
      `}</style>

      {/* Rain drops */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="rain-drop"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `rainDrop ${2 + Math.random() * 1.5}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Bee flying across top */}
      <div className="bee-container">
        <div
          className="bee-sprite"
          style={{
            left: `${beeX}%`,
            animation: 'flyBee 2s ease-in-out infinite',
          }}
        >
          🐝
        </div>
      </div>

      {/* Loading content */}
      <div
        style={{
          textAlign: 'center',
          zIndex: 10,
          position: 'relative',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            color: '#1A5A1A',
            marginBottom: '8px',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          The Quiet Garden
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#2A7A2A',
            marginBottom: '32px',
            fontStyle: 'italic',
          }}
        >
          The Valley That Forgot the Rain
        </p>

        {/* Dancing loading bar */}
        <div className="loading-bar-container">
          <div className="loading-bar-fill" />
        </div>

        <p
          style={{
            fontSize: '12px',
            color: '#4A9A4A',
            marginTop: '16px',
            fontWeight: '500',
          }}
        >
          Preparing the watershed...
        </p>
      </div>
    </div>
  );
}
