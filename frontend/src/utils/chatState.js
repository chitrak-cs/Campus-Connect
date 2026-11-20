// Tiny shared state: which chat room is currently open (used to suppress notifications for it)
let activeRoom = null;
export const setActiveChatRoom = (room) => { activeRoom = room; };
export const getActiveChatRoom = () => activeRoom;
