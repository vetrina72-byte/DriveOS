


import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { VehicleState, Action, VehicleContextType, DriveMode, ClimateState } from '../types';

const initialState: VehicleState = {
  driveMode: DriveMode.Park,
  battery: {
    level: 90,
    status: 'Idle',
    power: 0,
    voltage: 400,
    current: 0,
  },
  climate: {
    insideTemp: 22,
    outsideTemp: 18,
    acOn: true,
    frontDefrost: false,
    rearDefrost: false,
    fanSpeed: 2,
    driverSeatHeater: 0,
    passengerSeatHeater: 0,
    autoOn: false,
  },
  lightsOn: true,
  profile: 'Easy Entry',
};

const vehicleReducer = (state: VehicleState, action: Action): VehicleState => {
  switch (action.type) {
    case 'SET_DRIVE_MODE':
      return { ...state, driveMode: action.payload };
    case 'SET_CLIMATE':
      return { ...state, climate: { ...state.climate, ...action.payload } };
    case 'TOGGLE_LIGHTS':
      return { ...state, lightsOn: !state.lightsOn };
    case 'SET_PROFILE':
        return { ...state, profile: action.payload };
    case 'SIMULATE_UPDATE': {
        const newBatteryLevel = state.driveMode === DriveMode.Drive 
            ? Math.max(0, state.battery.level - 0.05) 
            : state.battery.level;
        return {
            ...state,
            battery: {
                ...state.battery,
                level: newBatteryLevel,
                power: state.driveMode === DriveMode.Drive ? 45 : 0,
                current: state.driveMode === DriveMode.Drive ? 112.5 : 0,
            },
            climate: {
                ...state.climate,
                outsideTemp: state.climate.outsideTemp + (Math.random() - 0.5) * 0.1
            }
        };
    }
    default:
      return state;
  }
};

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

// FIX: Refactored the provider to not use React.FC to avoid issues with the `children` prop typing in newer versions of @types/react.
export const VehicleProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(vehicleReducer, initialState);

  useEffect(() => {
    const simulationInterval = setInterval(() => {
      dispatch({ type: 'SIMULATE_UPDATE' });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(simulationInterval);
  }, [state.driveMode]); // Rerun effect if drive mode changes

  return (
    <VehicleContext.Provider value={{ state, dispatch }}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = (): VehicleContextType => {
  const context = useContext(VehicleContext);
  if (!context) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};