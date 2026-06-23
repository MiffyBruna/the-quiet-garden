/**
 * The Quiet Garden — root component.
 *
 * LandingPage is the initial welcome screen (Continue/Start).
 * GameScene is the primary interface (playable top-down world).
 * WatershedProgress is the optional overview, opened via the Journal button.
 */
import { useState, useCallback } from 'react';
import { registerKitLifecycles } from '../services/lifecycles';
import { track } from '../services/analytics';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { GameStats } from './engine/gameEngine';
import { LandingPage } from './LandingPage';
import { GameScene } from './GameScene';
import { WatershedProgress } from './WatershedProgress';

// ---------------------------------------------------------------------------
// Module-scope lifecycle registration (runs once per page load)
// ---------------------------------------------------------------------------

registerKitLifecycles({
  onPause:  () => { track('custom_game_paused'); },
  onResume: () => { track('custom_game_resumed'); },
  onSleep:  () => { track('custom_game_sleep'); },
  onQuit:   () => { track('custom_game_quit'); },
});

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

interface WatershedData {
  chapter1Restoration: number;
  discoveredWildlife: string[];
  discoveredFairies: string[];
  discoveredPlants: string[];
  newlyDiscovered: string[];
  gameStats: GameStats;
}

export function QuietGarden() {
  const [gameStarted, setGameStarted] = useState(false);
  const [isContinue, setIsContinue] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [watershedData, setWatershedData] = useState<WatershedData>({
    chapter1Restoration: 0,
    discoveredWildlife: [],
    discoveredFairies: [],
    discoveredPlants: [],
    newlyDiscovered: [],
    gameStats: {
      avgFertility: 0,
      bloomCount: 0,
      mulchCount: 0,
      restoration: 0,
      plantDiversity: 0,
      waterTileCount: 0,
    },
  });

  const handleStartGame = useCallback((isContinue: boolean) => {
    setIsContinue(isContinue);
    setGameStarted(true);
    RundotGameAPI.analytics.recordCustomEvent('landing_game_started', { isContinue: String(isContinue) });
  }, []);

  const handleOpenWatershed = useCallback(
    (restoration: number, wildlife: string[], fairies: string[], plants: string[], newlyDiscovered: string[], gameStats: GameStats) => {
      setWatershedData({
        chapter1Restoration: restoration,
        discoveredWildlife: wildlife,
        discoveredFairies: fairies,
        discoveredPlants: plants,
        newlyDiscovered,
        gameStats,
      });
      setShowWatershed(true);
      track('custom_watershed_opened');
    },
    [],
  );

  if (!gameStarted) {
    return <LandingPage onStart={handleStartGame} />;
  }

  return (
    <>
      <GameScene onShowWatershed={handleOpenWatershed} isContinue={isContinue} />
      {showWatershed && (
        <WatershedProgress
          chapter1Restoration={watershedData.chapter1Restoration}
          discoveredWildlife={watershedData.discoveredWildlife}
          discoveredFairies={watershedData.discoveredFairies}
          discoveredPlants={watershedData.discoveredPlants}
          newlyDiscovered={watershedData.newlyDiscovered}
          gameStats={watershedData.gameStats}
          onClose={() => {
            setShowWatershed(false);
            track('custom_watershed_closed');
          }}
        />
      )}
    </>
  );
}

export default QuietGarden;
