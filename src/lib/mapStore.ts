import { atom } from "nanostores";
import type { OrgWithChatContext } from "../interfaces/org";

export const $mapData = atom<OrgWithChatContext[]>([]);
