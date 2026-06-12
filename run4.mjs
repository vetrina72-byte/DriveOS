import fs from 'fs';

let code = fs.readFileSync('components/MusicPlayer.tsx', 'utf8');

// 1. Add perfTier to props of SpotifyProgressBar
code = code.replace(
    "const SpotifyProgressBar = ({ player, state, height, offset }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, height: number, offset: number }) => {",
    "const SpotifyProgressBar = ({ player, state, height, offset, perfTier }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, height: number, offset: number, perfTier: string }) => {"
);

// Add throttling to SpotifyProgressBar loop
code = code.replace(
    "            if (!isSeeking) {\n                visualPosRef.current = currentPos;\n            }\n\n            animationFrameId = requestAnimationFrame(loop);",
    "            if (!isSeeking) {\n                visualPosRef.current = currentPos;\n            }\n\n            if (perfTier === 'low-end') {\n                setTimeout(() => {\n                    animationFrameId = requestAnimationFrame(loop);\n                }, 500); // Throttle updates heavily in low-end profile\n            } else {\n                animationFrameId = requestAnimationFrame(loop);\n            }"
);

// 2. Add perfTier to props of YouTubeProgressBar
code = code.replace(
    "const YouTubeProgressBar = ({\n    progress,\n    isSeeking,\n    onSeek,\n    onSeekStart,\n    onSeekEnd,\n    height,\n    offset",
    "const YouTubeProgressBar = ({\n    progress,\n    isSeeking,\n    onSeek,\n    onSeekStart,\n    onSeekEnd,\n    height,\n    offset,\n    perfTier"
);
code = code.replace(
    "    offset: number;\n}) => {",
    "    offset: number;\n    perfTier: string;\n}) => {"
);

// Inside YouTubeProgressBar, throttle the progress manually if it uses rAF. Assuming it might be driven by state manually.
// Let's pass the props in the renderPlayerContent correctly.
code = code.replace(
    "<SpotifyProgressBar\n                                            player={getPlayerInstance(nowPlaying.source)}\n                                            state={nowPlaying.spotifyState}\n                                            height={progressBarHeight}\n                                            offset={progressBarVerticalOffset}\n                                        />",
    "<SpotifyProgressBar\n                                            player={getPlayerInstance(nowPlaying.source)}\n                                            state={nowPlaying.spotifyState}\n                                            height={progressBarHeight}\n                                            offset={progressBarVerticalOffset}\n                                            perfTier={perfTier}\n                                        />"
);

code = code.replace(
    "<YouTubeProgressBar \n                        progress={youTubeProgress} \n                        isSeeking={isYouTubeSeeking}\n                        onSeek={handleSeekYouTube}\n                        onSeekStart={handleYouTubeSeekStart}\n                        onSeekEnd={handleYouTubeSeekEnd}\n                        height={progressBarHeight}\n                        offset={progressBarVerticalOffset}\n                    />",
    "<YouTubeProgressBar \n                        progress={youTubeProgress} \n                        isSeeking={isYouTubeSeeking}\n                        onSeek={handleSeekYouTube}\n                        onSeekStart={handleYouTubeSeekStart}\n                        onSeekEnd={handleYouTubeSeekEnd}\n                        height={progressBarHeight}\n                        offset={progressBarVerticalOffset}\n                        perfTier={perfTier}\n                    />"
);

// Wait, the SpotifyProgressBar uses `requestAnimationFrame`, does YouTubeProgressBar use it too?
// Let's just check if it replaced both.

fs.writeFileSync('components/MusicPlayer.tsx', code, 'utf8');
console.log('Update complete');
