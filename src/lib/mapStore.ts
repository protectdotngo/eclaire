import { atom } from "nanostores";
import type { Data } from "../interfaces/dbData";

export const $mapData = atom<Data[]>([]);
