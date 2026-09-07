import styles from "./ResourcePartner.module.css";

interface ResourcePartnerProps {
  name: string;
  url: string;
}

export default function ResourcePartner(props: ResourcePartnerProps) {
  return (
    <a
      class={styles["v1-resource-card-badge"]}
      href={props.url}
      target="_blank"
      innerHTML={props.name}
    />
  );
}
