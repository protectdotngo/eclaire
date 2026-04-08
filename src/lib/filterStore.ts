import { atom } from "nanostores";
import type { Data } from "../interfaces/dbData";

export const $filterStore = atom<Array<Data> | null>(null);
