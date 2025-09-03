import type { RadioStation } from '../types';

export const curatedStations: RadioStation[] = [
    {
        stationuuid: 'curated-rtl-102-5',
        name: 'RTL 102.5',
        url_resolved: 'https://streamingv2.shoutcast.com/rtl-1025',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/RTL_102.5_logo.svg',
        tags: 'hits,pop,top40,italian',
        codec: 'MP3',
    },
    {
        stationuuid: 'curated-radio-deejay',
        name: 'Radio Deejay',
        url_resolved: 'https://streamcdnr11-4c4b867c89244861ac216426883d1ad0.msvdn.net/webradio/deejaywfmlinus/live.m3u8',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Logo_DeeJay.png',
        tags: 'hits,pop,dance,italian',
        codec: 'HLS',
    },
    {
        stationuuid: 'curated-radio-105',
        name: 'Radio 105 Network',
        url_resolved: 'https://icy.unitedradio.it/Radio105.mp3',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Radio_105_logo.svg',
        tags: 'hits,dance,pop',
        codec: 'MP3',
    },
    {
        stationuuid: 'curated-r101',
        name: 'R101',
        url_resolved: 'https://icy.unitedradio.it/R101_558.aac',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/R101_-_Logo_2015.svg',
        tags: 'hits,pop,top40',
        codec: 'AAC',
    },
    {
        stationuuid: 'curated-virgin-radio',
        name: 'Virgin Radio Italia',
        url_resolved: 'https://icy.unitedradio.it/Virgin.mp3',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/VirginRadio.png',
        tags: 'rock,alternative',
        codec: 'MP3',
    },
    {
        stationuuid: 'curated-radio-italia',
        name: 'Radio Italia Solo Musica Italiana',
        url_resolved: 'https://radioitaliasmi.akamaized.net/hls/live/2093120/RISMI/stream01/streamPlaylist.m3u8',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Radio_Italia_logo_%282020%29.svg',
        tags: 'italian,pop',
        codec: 'HLS',
    },
    {
        stationuuid: 'curated-kiss-kiss',
        name: 'Radio Kiss Kiss',
        url_resolved: 'https://ice06.fluidstream.net:8080/KissKiss.mp3',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Kiss_95.9.png',
        tags: 'hits,pop,italian',
        codec: 'MP3',
    },
    {
        stationuuid: 'curated-radio-80',
        name: 'Radio 80',
        url_resolved: 'https://wma01.fluidstream.net/radio80.mp3',
        favicon: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/80s80s_Logo_2015.svg',
        tags: '80s,anni 80,pop',
        codec: 'MP3',
    }
];