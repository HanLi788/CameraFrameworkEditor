import {createContext,useContext} from 'react';
export const ReferenceCatalog=createContext<any>(null);
export const useReferenceCatalog=()=>useContext(ReferenceCatalog);
