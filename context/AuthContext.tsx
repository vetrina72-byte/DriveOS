
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        try {
            const sid = sessionIdRef.current;
            // CRITICAL FIX: Add credentials: 'include' to send cookies to the backend
            const res = await fetch(`/api/refresh-token`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-id': sid 
                },
                credentials: 'include' 
            });
            const data = await res.json();
            if (res.ok && data.access_token) {
                const { access_token, expires_in, expires_at } = data;
                const newExpiresAt = expires_at || (Date.now() + expires_in * 1000);
                
                localStorage.setItem('accessToken', access_token);
                localStorage.setItem('expiresAt', String(newExpiresAt));
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                
                setState(prev => ({
                    ...prev,
                    accessToken: access_token,
                    expiresAt: newExpiresAt,
                }));
                return true;
            }
            return false;
        } catch (e) {
            console.error('Refresh token failed', e);
            return false;
        }
    }, []);
