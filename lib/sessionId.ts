export const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
});

export const getSessionId = (): string => {
    let sid = localStorage.getItem('spotify_session_id');
    if (!sid) {
        sid = generateUUID();
        localStorage.setItem('spotify_session_id', sid);
    }
    return sid;
};
