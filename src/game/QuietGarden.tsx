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
}

export function QuietGarden() {
  const [gameStarted, setGameStarted] = useState(false);
  const [isContinue, setIsContinue] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string>('dryland');
  const [watershedData, setWatershedData] = useState<WatershedData>({
    chapter1Restoration: 0,
    discoveredWildlife: [],
    discoveredFairies: [],
    discoveredPlants: [],
  });

  const handleStartGame = useCallback((isContinue: boolean) => {
    setIsContinue(isContinue);
    setGameStarted(true);
    RundotGameAPI.analytics.recordCustomEvent('landing_game_started', { isContinue: String(isContinue) });
  }, []);

  const handleOpenWatershed = useCallback(
    (restoration: number, wildlife: string[], fairies: string[], plants: string[]) => {
      setWatershedData({
        chapter1Restoration: restoration,
        discoveredWildlife: wildlife,
        discoveredFairies: fairies,
        discoveredPlants: plants,
      });
      setShowWatershed(true);
      track('custom_watershed_opened');
    },
    [],
  );

  const handleSelectChapter = useCallback((chapterId: string) => {
    setSelectedChapter(chapterId);
    setShowWatershed(false);
    track('custom_chapter_selected', { chapter: chapterId });
  }, []);

  if (!gameStarted) {
    return <LandingPage onStart={handleStartGame} />;
  }

  return (
    <>
      <GameScene onShowWatershed={handleOpenWatershed} isContinue={isContinue} selectedChapter={selectedChapter} />
      {showWatershed && (
        <WatershedProgress
          chapter1Restoration={watershedData.chapter1Restoration}
          discoveredWildlife={watershedData.discoveredWildlife}
          discoveredFairies={watershedData.discoveredFairies}
          discoveredPlants={watershedData.discoveredPlants}
          onClose={() => {
            setShowWatershed(false);
            track('custom_watershed_closed');
          }}
          onSelectChapter={handleSelectChapter}
        />
      )}
    </>
  );
}

export default QuietGarden;
