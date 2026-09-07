import { Show } from "solid-js";
import FieldText from "./FieldText";
import FieldTextarea from "./FieldTextarea";
import FieldArrayText from "./FieldArrayText";
import FieldCategories from "./FieldCategories";
import { useProposalForm } from "./proposeContext";
import styles from "./OrgFieldsSection.module.css";

export default function OrgFieldsSection() {
  const f = useProposalForm();
  const visible = () =>
    f.form.action !== "" &&
    !(f.form.action === "modify" && !f.form.modifying_org_id);

  return (
    <Show when={visible()}>
      <div class={styles["proposal-section"]}>
        <h2 class={styles["proposal-section-title"]}>
          Informations sur l'organisation
        </h2>

        <FieldText
          name="name"
          label="Nom de l'organisation"
          required
          placeholder="ex. Association pour l'inclusion numérique"
        />

        <FieldTextarea
          name="desc"
          label="Description"
          required
          placeholder="Décris ce que fait l'organisation, ses activités principales, son public..."
          rows={6}
        />

        <FieldCategories />

        <FieldText
          name="domain"
          label="Site web"
          type="url"
          required
          placeholder="https://..."
        />

        <FieldText
          name="address"
          label="Adresse (rue et numéro)"
          placeholder="ex. Rue de la Servette 91"
        />

        <FieldText
          name="city"
          label="Ville (nom et code postal)"
          placeholder="ex. 1202 Genève"
        />

        <FieldText
          name="rss"
          label="Flux RSS d'actualités"
          type="url"
          placeholder="URL du flux RSS pour les news (optionnel)"
        />

        <FieldText
          name="events_url"
          label="Page des événements"
          type="url"
          placeholder="URL de la page qui liste les événements (optionnel)"
        />

        <FieldText
          name="news_url"
          label="Page d'actualités"
          type="url"
          placeholder="URL de la page d'actualités (optionnel)"
        />

        <FieldArrayText
          name="socials"
          label="Réseaux sociaux"
          placeholder="URL du profil (Facebook, Instagram, LinkedIn...)"
          type="url"
        />

        <FieldArrayText
          name="contact"
          label="Contacts (emails, téléphones)"
          placeholder="email@example.com ou +41 22 xxx xx xx"
          type="text"
        />
      </div>
    </Show>
  );
}
