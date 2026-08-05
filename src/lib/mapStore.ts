import { atom } from "nanostores";
import type { OrgWithChatContext } from "../interfaces";

export const $mapData = atom<OrgWithChatContext[]>([]);
