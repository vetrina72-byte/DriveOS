
import { useState, useEffect, useCallback } from 'react';

// Client ID has been set with the one provided by the user.
const SPOTIFY_CLIENT_ID = 'ecc9e126d442404b92e8081c7d95ecca'; 

// Use a dynamic Redirect URI based on the current location.
// This works for both local development (on any port) and deployed environments.
const REDIRECT_URI = `${window.location.origin}/callback.html`;


export const useSpotifyAuth = () => {
    // On initial load, read the token from localStorage.
    const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('spotify_access_token'));
    const [userInfo, setUserInfo] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const login = useCallback(async () => {
        // Clear previous error state before new login attempt
        setError(null);
        localStorage.removeItem('spotify_auth_error');

        const scope = 'user-read-private user-read-email playlist-read-private user-library-read streaming user-read-recently-played';
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        
        const params = {
            response_type: 'token',
            client_id: SPOTIFY_CLIENT_ID,
            scope,
            redirect_uri: REDIRECT_URI,
        };

        authUrl.search = new URLSearchParams(params).toString();
        // Open in a popup to work around iframe restrictions.
        window.open(authUrl.toString(), 'spotify_login', 'width=500,height=600,popup');
    }, []);

    const logout = useCallback(() => {
        setAccessToken(null);
        setUserInfo(null);
        setError(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires_at');
        localStorage.removeItem('spotify_auth_error');
    }, []);
    
    // This effect listens for authentication results from the popup window via localStorage.
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'spotify_access_token' && event.newValue) {
                setAccessToken(event.newValue);
            }
             if (event.key === 'spotify_auth_error' && event.newValue) {
                setError(event.newValue);
                localStorage.removeItem('spotify_auth_error'); // Clean up after reading error
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);
    
    // Check for token expiration
    useEffect(() => {
        const expiresAt = localStorage.getItem('spotify_token_expires_at');
        if (accessToken && expiresAt && Date.now() > parseInt(expiresAt)) {
           logout();
           setError("Your Spotify session has expired. Please log in again.");
        }
    }, [accessToken, logout]);

    // Fetch user info when access token is available
    useEffect(() => {
        if (!accessToken) {
            setUserInfo(null);
            return;
        };

        const fetchUserInfo = async () => {
            try {
                const response = await fetch("https://api.spotify.com/v1/me", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                 if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        // The token is invalid, log out.
                        logout();
                        setError("Your Spotify session is invalid. Please log in again.");
                    } else {
                       const errorData = await response.json();
                       throw new Error(errorData?.error?.message || "Failed to fetch user info. Your session may have expired.");
                    }
                }
                const data = await response.json();
                setUserInfo(data);
                setError(null); // Clear previous errors on success
            } catch (err: any) {
                // To prevent error loops, only set the error if it's a new one.
                if (error !== err.message) {
                   setError(err.message);
                }
                console.error(err);
            }
        };
        
        fetchUserInfo();

    }, [accessToken, logout]);
    
    return { accessToken, userInfo, error, login, logout };
};
