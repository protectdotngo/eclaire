import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { Org } from "../../../interfaces/org";
import type {
  ArrayField,
  ProposalFormData,
  StringField,
} from "../../../lib/proposalFormState";

export interface ProposalStore {
  /**
   * `createStore` proxy: reading `form[k]` tracks a dependency on that single
   * field. Replaces the `formData` object Alpine shared by scope inheritance.
   */
  form: ProposalFormData;
  setField(k: StringField, v: string): void;
  setArrayItem(k: ArrayField, i: number, v: string): void;
  pushArrayItem(k: ArrayField): void;
  removeArrayItem(k: ArrayField, i: number): void;
  toggleCategory(name: string): void;
  toggleAudience(name: string): void;

  allOrgs: Accessor<readonly Org[]>;
  originalOrg: Accessor<Org | null>;
  submitting: Accessor<boolean>;
  error: Accessor<string>;
  canSubmit: Accessor<boolean>;

  onActionChange(): void;
  onOrgSelected(): void;
  submitForm(): Promise<void>;
}

export const ProposalContext = createContext<ProposalStore>();

export function useProposalForm(): ProposalStore {
  const ctx = useContext(ProposalContext);
  if (!ctx) {
    throw new Error("useProposalForm() doit etre appele dans <ProposalForm>");
  }
  return ctx;
}
