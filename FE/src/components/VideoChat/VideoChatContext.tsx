// VideoChatContext.tsx
import React, { createContext, useContext, ReactNode, useState } from 'react';

// Define our context state type
interface VideoChatContextState {
  isRoomMinimized: boolean;
  setIsRoomMinimized: React.Dispatch<React.SetStateAction<boolean>>;
}

// Create the context with a default value (to avoid undefined checks)
const VideoChatContext = createContext<VideoChatContextState>({
  isRoomMinimized: true,
  setIsRoomMinimized: () => {} // No-op function as default
});

// Create the provider component
export const VideoChatProvider: React.FC<{ children: ReactNode; initialMinimized?: boolean }> = ({ 
  children, 
  initialMinimized = true 
}) => {
  const [isRoomMinimized, setIsRoomMinimized] = useState(initialMinimized);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    isRoomMinimized,
    setIsRoomMinimized
  }), [isRoomMinimized]);

  return (
    <VideoChatContext.Provider value={contextValue}>
      {children}
    </VideoChatContext.Provider>
  );
};

// Custom hook for using the context
export const useVideoChatContext = () => useContext(VideoChatContext);