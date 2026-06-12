import fs from 'fs';
let code = fs.readFileSync('components/MusicPlayer.tsx', 'utf8');

code = code.replace(
    '            {/* PERFORMANCE TELEMETRY OVERLAY */}\n            <div className="fixed top-4 right-4',
    '            {/* PERFORMANCE TELEMETRY OVERLAY */}\n            {import.meta.env.DEV && (\n            <div className="fixed top-4 right-4'
);

code = code.replace(
    '                    </div>\n                </div>\n            </div>\n            <div \n                ref={playerContainerRef}',
    '                    </div>\n                </div>\n            </div>\n            )}\n            <div \n                ref={playerContainerRef}'
);

fs.writeFileSync('components/MusicPlayer.tsx', code, 'utf8');
console.log('Update complete');
