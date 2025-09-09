import React from 'react';
import { 
    FiWind, FiThermometer, FiSpeaker, FiPlay, FiPause, FiSkipBack, FiSkipForward, FiSearch, FiHome, FiBriefcase, FiLock, FiUnlock, FiUser, FiMoreHorizontal, FiMonitor, FiTrello, FiSun, FiMoon, FiCalendar, FiMessageSquare, FiGift, FiGlobe, FiMusic, FiVideo, FiUmbrella, FiDroplet, FiXCircle, FiRadio
} from 'react-icons/fi';
import { 
    BsBatteryHalf, BsBatteryFull, BsBatteryCharging, BsFan
} from 'react-icons/bs';
import { 
    GiCarDoor, GiCarSeat, GiGearStick, GiSteeringWheel 
} from 'react-icons/gi';
import { 
    MdAcUnit, MdOutlinePhone, MdOutlineApps, MdBluetooth, MdWifi, MdGpsFixed, MdOutlineSettings, MdFlashOn, MdFlashOff, MdOutlineMic, MdEvStation
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

const TheaterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <linearGradient id="clapperBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#404040"/>
                <stop offset="100%" stopColor="#262626"/>
            </linearGradient>
            <filter id="playButtonShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.5"/>
            </filter>
        </defs>
        {/* Main Body */}
        <path d="M22 6.389H2V20.833C2 21.416 2.473 21.889 3.056 21.889H20.944C21.527 21.889 22 21.416 22 20.833V6.389Z" fill="url(#clapperBodyGrad)"/>
        {/* Clapper Top Part */}
        <g fill="#A3A3A3">
            <path d="M20.944 3.111L3.056 3.111C2.473 3.111 2 3.584 2 4.167L2 5.278L22 5.278L22 4.167C22 3.584 21.527 3.111 20.944 3.111Z"/>
            <path d="M4.694 3.111L6.361 1H7.75L6.083 3.111H4.694Z"/>
            <path d="M9.139 3.111L10.806 1H12.194L10.528 3.111H9.139Z"/>
            <path d="M13.583 3.111L15.25 1H16.639L14.972 3.111H13.583Z"/>
            <path d="M18.028 3.111L19.694 1H21.083L19.417 3.111H18.028Z"/>
        </g>
        {/* Play Button */}
        <g filter="url(#playButtonShadow)">
            <path d="M9.5 15.5V9.5L15.5 12.5L9.5 15.5Z" fill="#FFFFFF"/>
        </g>
    </svg>
);

const YouTubeMusicIcon = (props: React.HTMLAttributes<HTMLImageElement>) => (
    <img 
        src="https://upload.wikimedia.org/wikipedia/commons/f/fc/Youtube_shorts_icon.svg" 
        alt="YouTube Music" 
        {...props}
    />
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
    theater: TheaterIcon,
    phone: MdOutlinePhone,
    settings: MdOutlineSettings,
    car: PiCarSimpleBold,
    voice: MdOutlineMic,
    spotify: FaSpotify,
    youtube: YouTubeMusicIcon,
    maps: MapsIcon,
    radio: FiRadio,
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
    tunein: FiMusic,
    tidal: SiTidal,

    // Connectivity
    bluetooth: MdBluetooth,
    wifi: MdWifi,
};