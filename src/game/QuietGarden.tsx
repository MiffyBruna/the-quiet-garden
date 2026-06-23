/**
 * The Quiet Garden — root component.
 *
 * LandingPage is the initial welcome screen (Continue/Start).
 * GameScene is the primary interface (playable top-down world).
 * WatershedProgress is the optional overview, opened via the Journal button.
 * Credits is the post-game screen showing contributors.
 * CreditsModal is the post-credits "add your name" prompt.
 */
import { useState, useCallback, useEffect } from 'react';
import { registerKitLifecycles } from '../services/lifecycles';
import { track } from '../services/analytics';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { GameStats } from './engine/gameEngine';
import { LandingPage } from './LandingPage';
import { GameScene } from './GameScene';
import { WatershedProgress } from './WatershedProgress';
import { Credits, Credit } from './Credits';
import { CreditsModal } from './CreditsModal';
import { loadCredits, addCredit } from '../services/credits';

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
  hasMatureMesquite: boolean;
}

export function QuietGarden() {
  const [gameStarted, setGameStarted] = useState(false);
  const [isContinue, setIsContinue] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [allCredits, setAllCredits] = useState<Credit[]>([]);
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
    hasMatureMesquite: false,
  });

  // Load credits on mount
  useEffect(() => {
    const credits = loadCredits();
    setAllCredits(credits);
  }, []);

  const handleStartGame = useCallback((isContinue: boolean) => {
    setIsContinue(isContinue);
    setGameStarted(true);
    RundotGameAPI.analytics.recordCustomEvent('landing_game_started', { isContinue: String(isContinue) });
  }, []);

  const handleOpenWatershed = useCallback(
    (restoration: number, wildlife: string[], fairies: string[], plants: string[], newlyDiscovered: string[], gameStats: GameStats, hasMatureMesquite: boolean) => {
      setWatershedData({
        chapter1Restoration: restoration,
        discoveredWildlife: wildlife,
        discoveredFairies: fairies,
        discoveredPlants: plants,
        newlyDiscovered,
        gameStats,
        hasMatureMesquite,
      });
      setShowWatershed(true);
      track('custom_watershed_opened');
    },
    [],
  );

  const handleGameComplete = useCallback(() => {
    setShowCredits(true);
    RundotGameAPI.analytics.recordCustomEvent('game_completed', { hasCredits: String(allCredits.length > 0) });
  }, [allCredits.length]);

  const handleCreditsFinished = useCallback(() => {
    setShowCredits(false);
    setShowCreditsModal(true);
    RundotGameAPI.analytics.recordCustomEvent('credits_screen_finished');
  }, []);

  const handleNameAdded = useCallback((name: string) => {
    const newCredit = addCredit(name);
    setAllCredits((prev) => [...prev, newCredit]);
    setShowCreditsModal(false);
    RundotGameAPI.analytics.recordCustomEvent('credits_name_saved', { nameLength: String(name.length) });
  }, []);

  const handleCloseCreditsModal = useCallback(() => {
    setShowCreditsModal(false);
    RundotGameAPI.analytics.recordCustomEvent('credits_modal_closed_skip');
  }, []);

  if (!gameStarted) {
    return <LandingPage onStart={handleStartGame} />;
  }

  return (
    <>
      <GameScene onShowWatershed={handleOpenWatershed} isContinue={isContinue} onGameComplete={handleGameComplete} />
      {showWatershed && (
        <WatershedProgress
          chapter1Restoration={watershedData.chapter1Restoration}
          discoveredWildlife={watershedData.discoveredWildlife}
          discoveredFairies={watershedData.discoveredFairies}
          discoveredPlants={watershedData.discoveredPlants}
          newlyDiscovered={watershedData.newlyDiscovered}
          gameStats={watershedData.gameStats}
          hasMatureMesquite={watershedData.hasMatureMesquite}
          onClose={() => {
            setShowWatershed(false);
            track('custom_watershed_closed');
          }}
        />
      )}
      {showCredits && (
        <Credits credits={allCredits} onCreditsFinished={handleCreditsFinished} />
      )}
      {showCreditsModal && (
        <CreditsModal onNameAdded={handleNameAdded} onClose={handleCloseCreditsModal} />
      )}
    </>
  );
}

export default QuietGarden;
