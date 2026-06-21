/**
 * LoadingScreen — animated loading screen with rain, sparkles, dancing bar, and flying bee
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
        background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #A8A878 80%, #8B7355 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap');

        @keyframes rainDrop {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0) translateY(0); }
          50% { opacity: 1; transform: scale(1) translateY(-30px); }
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

        @keyframes floatCloud {
          0% { transform: translateX(-100px); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateX(100vw); opacity: 0; }
        }

        .rain-drop {
          position: absolute;
          width: 2px;
          height: 20px;
          background: linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0));
          opacity: 0;
          box-shadow: 0 0 2px rgba(255,255,255,0.6);
        }

        .sparkle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, #FFD700 0%, rgba(255,255,255,0.8) 70%);
          border-radius: 50%;
          opacity: 0;
          box-shadow: 0 0 4px rgba(255,215,0,0.8);
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

        .cloud {
          position: absolute;
          pointer-events: none;
          font-size: 60px;
        }
      `}</style>

      {/* Heavy rain drops */}
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={`rain-${i}`}
          className="rain-drop"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `rainDrop ${1.5 + Math.random() * 2}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
            height: `${12 + Math.random() * 12}px`,
          }}
        />
      ))}

      {/* Sparkles/particles in sky */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={`sparkle-${i}`}
          className="sparkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 50}%`,
            animation: `sparkle ${2 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
          }}
        />
      ))}

      {/* Cartoon clouds floating */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`cloud-${i}`}
          className="cloud"
          style={{
            top: `${10 + Math.random() * 40}%`,
            animation: `floatCloud ${8 + Math.random() * 6}s linear infinite`,
            animationDelay: `${Math.random() * 3}s`,
            opacity: 0.5 + Math.random() * 0.3,
          }}
        >
          ☁️
        </div>
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '37px',
            marginBottom: '8px',
            fontWeight: 400,
            fontFamily: "'Abril Fatface', serif",
            letterSpacing: '1px',
          }}
        >
          <span style={{ color: '#FFF8DC', textShadow: '-1px -1px 0 #3D2817, 1px -1px 0 #3D2817, -1px 1px 0 #3D2817, 1px 1px 0 #3D2817' }}>The Quiet Garden</span>
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
