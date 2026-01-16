
    // --- CONTROLLO PRODOTTO PREMIUM ---
    if (!userData.product || userData.product !== 'premium') {
      console.log(`[SPOTIFY CALLBACK] Account NON premium per session: ${sessionId} (Product: ${userData.product})`);
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 3600); 
      return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    // FIX: Increase TTL from 3600 (1h) to 2592000 (30 days) so session persists for refresh
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 2592000); 
    sendCallbackPage(res, { success: true });

  } catch (e) {
    console.error(`[SPOTIFY CALLBACK] Exception: ${e.message}`);
