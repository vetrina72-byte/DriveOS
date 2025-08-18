
import React from 'react';
import { 
    FiWind, FiThermometer, FiSpeaker, FiPlay, FiPause, FiSkipBack, FiSkipForward, FiSearch, FiHome, FiBriefcase, FiLock, FiUnlock, FiUser, FiMoreHorizontal, FiMonitor, FiTrello, FiSun, FiMoon, FiCalendar, FiMessageSquare, FiGift, FiGlobe, FiMusic, FiVideo, FiUmbrella, FiDroplet, FiXCircle
} from 'react-icons/fi';
import { 
    BsBatteryHalf, BsBatteryFull, BsBatteryCharging, BsFan
} from 'react-icons/bs';
import { 
    GiCarDoor, GiCarSeat, GiGearStick, GiSteeringWheel 
} from 'react-icons/gi';
import { 
    MdAcUnit, MdOutlineTheaters, MdOutlinePhone, MdOutlineApps, MdBluetooth, MdWifi, MdGpsFixed, MdOutlineSettings, MdFlashOn, MdFlashOff, MdOutlineMic, MdEvStation, MdRadio
} from 'react-icons/md';
import { 
    PiFanFill, PiSeatbeltFill, PiCarSimpleBold 
} from "react-icons/pi";
import { FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa';
import { IoGameControllerOutline } from 'react-icons/io5';
import { SiTidal } from 'react-icons/si';

const MapsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            {/* Subtle background gradient for depth */}
            <radialGradient id="maps-icon-bg-grad" cx="50%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#2a2a2e" />
                <stop offset="100%" stopColor="#18181B" />
            </radialGradient>
            
            {/* Shadow filter for the navigation arrow */}
            <filter id="maps-icon-arrow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5"/>
            </filter>
        </defs>

        {/* Background */}
        <rect width="50" height="50" rx="10" fill="url(#maps-icon-bg-grad)"/>
        
        {/* Subtle grid texture */}
        <g opacity="0.1" stroke="#FFFFFF" strokeWidth="0.5">
            <path d="M0 12.5 H50 M0 25 H50 M0 37.5 H50" />
            <path d="M12.5 0 V50 M25 0 V50 M37.5 0 V50" />
        </g>
      
        {/* Blue road with an under-stroke for definition */}
        <path d="M8 42 C 20 30, 30 20, 42 8" stroke="#1E40AF" strokeWidth="6" strokeLinecap="round" />
        <path d="M8 42 C 20 30, 30 20, 42 8" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" />
      
        {/* Static Red navigation arrow, pointing in the opposite direction */}
        <g transform="translate(25 25) scale(1.6) rotate(45)" filter="url(#maps-icon-arrow-shadow)">
            {/* Right (darker) facet */}
            <path 
                d="M0 -8 L6.5 6 L0 2.5 Z"
                fill="#DC2626"
            />
            {/* Left (lighter) facet */}
            <path
                d="M0 -8 L0 2.5 L-6.5 6 Z"
                fill="#F87171"
            />
            {/* White outline on top for crispness */}
            <path 
                d="M0 -8 L6.5 6 L0 2.5 L-6.5 6 Z" 
                fill="none"
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round" 
                strokeLinecap="round"
            />
        </g>
    </svg>
);


export const ICONS = {
    // Weather
    wind: FiWind,
    rainChance: FiUmbrella,
    humidity: FiDroplet,
    thermometer: FiThermometer,
    
    // Climate
    ac: MdAcUnit,
    fan: PiFanFill,
    frontDefrost: FiTrello,
    rearDefrost: FiMonitor,
    seat: GiCarSeat,
    
    // Vehicle Status
    battery: BsBatteryHalf,
    batteryCharging: BsBatteryCharging,
    batteryFull: BsBatteryFull,
    lightsOn: MdFlashOn,
    lightsOff: MdFlashOff,
    lock: FiLock,
    unlock: FiUnlock,
    profile: FiUser,
    seatbelt: PiSeatbeltFill,

    // Media
    play: FiPlay,
    pause: FiPause,
    skipBack: FiSkipBack,
    skipForward: FiSkipForward,
    volume: FiSpeaker,
    search: FiSearch,
    
    // Navigation
    home: FiHome,
    work: FiBriefcase,
    gps: MdGpsFixed,
    endTrip: FiXCircle,

    // Dock
    apps: MdOutlineApps,
    climate: FiThermometer,
    theater: MdOutlineTheaters,
    phone: MdOutlinePhone,
    settings: MdOutlineSettings,
    car: PiCarSimpleBold,
    voice: MdOutlineMic,
    spotify: FaSpotify,
    maps: MapsIcon,
    sun: FiSun,
    moon: FiMoon,
    more: FiMoreHorizontal,

    // App Launcher Icons
    dashcam: FiVideo,
    energy: MdEvStation,
    calendar: FiCalendar,
    messages: FiMessageSquare,
    arcade: IoGameControllerOutline,
    toybox: FiGift,
    browser: FiGlobe,
    radio: MdRadio,
    tunein: FiMusic,
    tidal: SiTidal,

    // Connectivity
    bluetooth: MdBluetooth,
    wifi: MdWifi,
};
