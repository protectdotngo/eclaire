import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { Detail, ListItem, OrgField } from "../../interfaces/verification";
import type {
  FieldState,
  StatusClass,
  SubmitMode,
} from "../../lib/verificationState";

export interface VerificationStore {
  items: Accessor<readonly ListItem[]>;
  loading: Accessor<boolean>;
  listError: Accessor<string>;

  active: Accessor<Detail | null>;
  activeId: Accessor<string>;

  /** Proxy `createStore` : cle dynamique, reactivite fine par champ. */
  fieldValues: Record<string, string>;
  setFieldValue(field: string, value: string): void;

  adminEditor: Accessor<string>;
  setAdminEditor(v: string): void;

  busy: Accessor<boolean>;
  status: Accessor<string>;
  statusClass: Accessor<StatusClass>;

  tip: Accessor<{ text: string; top: number; left: number }>;
  showTip(ev: { currentTarget: EventTarget | null }, field: string): void;
  hideTip(): void;

  fieldOrder: readonly OrgField[];
  arrayFields: readonly OrgField[];
  fieldLabels: Record<string, string>;
  fieldState(field: string): FieldState;

  open(id: string): Promise<void>;
  close(): void;
  submit(mode: SubmitMode): Promise<void>;

  /** Remplace $root.querySelector(".detail") — et survit au hachage CSS. */
  registerDetailRef(el: HTMLElement | undefined): void;
}

export const VerificationContext = createContext<VerificationStore>();

export function useVerification(): VerificationStore {
  const ctx = useContext(VerificationContext);
  if (!ctx) {
    throw new Error("useVerification() doit etre appele dans <Verification>");
  }
  return ctx;
}
