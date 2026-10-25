import { createContext, useContext } from "react";
import type { Labeler } from "../lib/names.ts";

// Code -> display name substitution. Identity unless names are on and loaded (memory only).
export const NamesContext = createContext<Labeler>((t) => t);
export const useLabel = (): Labeler => useContext(NamesContext);
