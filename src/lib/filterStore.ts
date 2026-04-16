import { atom } from "nanostores";
import type { Data } from "../interfaces/dbData";

export const $filterStore = atom<Data[]>([]);
