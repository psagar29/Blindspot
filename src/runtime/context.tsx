import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { RuntimeBridge } from '../../shared/contracts';
import { RuntimeStore } from './store';

const Context=createContext<RuntimeStore|null>(null);
export function RuntimeRoot({children}:{children:ReactNode}){const [store]=useState(()=>new RuntimeStore());useEffect(()=>{void store.init();return()=>{void store.dispose();};},[store]);return <Context.Provider value={store}>{children}</Context.Provider>;}
export function useRuntimeStore(){const store=useContext(Context);if(!store)throw new Error('Blindspot requires RuntimeRoot.');return store;}
export function useBlindspot():RuntimeBridge{const store=useRuntimeStore(),state=useSyncExternalStore(store.subscribe,store.snapshot);return {state,actions:store.actions};}
