import fs from 'fs';

const code = fs.readFileSync('components/MapsContainer.tsx', 'utf8');

// We need to find the `</style>` that is literally at the end of the file contents right now and replace it.
// The file right now has:
/**
    const mapHtmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    ...
    </body>
    </html>
          </style>
        `;
        return mapHtmlContent.replace('</head>', `${dynamicStyles}</head>`);
      }, [satelliteLabelBrightness, satelliteLabelOutlineWidth]);
*/

const searchStr = "</html>\n\n      </style>\n    `;\n    return mapHtmlContent.replace('</head>', `${dynamicStyles}</head>`);";

const correctMapEnd = "</html>\n`;";

const boilerplate = `
export interface MapsContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onInteractionStart?: () => void;
  isNight: boolean;
  searchPanelWidth?: number;
  searchPanelTop?: number | string;
  navigationTarget: { lat: number; lng: number; name: string; isPreset?: 'home' | 'work'; coords?: {lat: number, lng: number} } | null;
  spotifyPlayerTop?: string | number;
  spotifyPlayerBottom?: string | number;
  satelliteLabelBrightness: number;
  satelliteLabelOutlineWidth: number;
  onDragProgress?: (progress: number | null) => void;
  currentPosition?: {lat: number, lng: number} | null;
  homeLocation?: {lat: number, lng: number, name: string} | null;
  workLocation?: {lat: number, lng: number, name: string} | null;
  onSelectDestination?: (target: { lat: number; lng: number; name: string; isPreset?: 'home' | 'work'; coords?: {lat: number, lng: number} } | null) => void;
  width?: number;
  widgetBgColor?: string;
  dayPlayerButtonColor?: string;
  nightPlayerButtonColor?: string;
  darkNavigateInputBg?: string;
}

const MapsContainer = React.memo(({
  isOpen,
  onClose,
  onInteractionStart,
  isNight,
  searchPanelWidth,
  searchPanelTop,
  navigationTarget,
  spotifyPlayerTop,
  spotifyPlayerBottom,
  satelliteLabelBrightness,
  satelliteLabelOutlineWidth,
  onDragProgress,
  currentPosition,
  homeLocation,
  workLocation,
  onSelectDestination,
  width,
  widgetBgColor,
  dayPlayerButtonColor,
  nightPlayerButtonColor,
  darkNavigateInputBg
}: MapsContainerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeReady, setIsIframeReady] = useState(false);

  // We add dynamic styles to adjust contrast of protomaps labels in satellite mode
  const processedHtmlContent = useMemo(() => {
    const dynamicStyles = \`
      <style>
        .maplibregl-ctrl-logo, .maplibregl-ctrl-attrib {
            display: none !important;
        }
      </style>
    \`;
    return mapHtmlContent.replace('</head>', \`\${dynamicStyles}</head>\`);
`;

const index = code.indexOf(searchStr);
if (index !== -1) {
    const newCode = code.substring(0, index) + correctMapEnd + "\n" + boilerplate + code.substring(index + searchStr.length);
    fs.writeFileSync('components/MapsContainer.tsx', newCode);
    console.log("Successfully patched MapsContainer!");
} else {
    console.log("Could not find the broken string to patch.", searchStr.substring(0, 50));
    // Let's try finding just the end part
    const endStr = "</style>\n    `;\n    return mapHtmlContent.replace('</head>', `${dynamicStyles}</head>`);";
    const endIndex = code.indexOf(endStr);
    if (endIndex !== -1) {
        // we replace from right after </html> till the end
        const beforeHtmlEnd = code.lastIndexOf("</html>", endIndex);
        if (beforeHtmlEnd !== -1) {
            const newCode2 = code.substring(0, beforeHtmlEnd + 7) + "\n" + correctMapEnd + "\n" + boilerplate + code.substring(endIndex + endStr.length);
            fs.writeFileSync('components/MapsContainer.tsx', newCode2);
            console.log("Successfully patched MapsContainer (fallback)");
        }
    } else {
      console.log("Total failure to match endStr");
    }
}
