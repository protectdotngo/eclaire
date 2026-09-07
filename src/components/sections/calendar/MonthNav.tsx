import { Show } from "solid-js";
import Icon from "../../icons/Icon";
import { useCalendar } from "./calendarContext";
import chevronLeftRaw from "../../../assets/images/chevron-left.svg?raw";
import chevronRightRaw from "../../../assets/images/chevron-right.svg?raw";
import refreshRaw from "../../../assets/images/refresh.svg?raw";
import styles from "./MonthNav.module.css";

export default function MonthNav() {
  const cal = useCalendar();
  const prevDisabled = () => !cal.includePast() && cal.isCurrentMonth();
  return (
    <div class={styles["month-nav"]}>
      <button
        type="button"
        classList={{
          [styles["month-nav-btn"]]: true,
          // Classe sans regle CSS (le style vient de .month-nav-btn:disabled) :
          // gardee litterale pour ne pas changer le DOM, et parce qu'un lookup
          // de module renverrait `undefined`.
          "month-nav-btn-disabled": prevDisabled(),
        }}
        disabled={prevDisabled()}
        onClick={() => cal.prevMonth()}
        aria-label="Mois précédent"
      >
        <Icon raw={chevronLeftRaw} />
      </button>
      <h2 class={styles["month-nav-title"]}>{cal.currentMonthLabel()}</h2>
      <button
        type="button"
        class={styles["month-nav-btn"]}
        onClick={() => cal.nextMonth()}
        aria-label="Mois suivant"
      >
        <Icon raw={chevronRightRaw} />
      </button>
      <Show when={!cal.isCurrentMonth()}>
        <button
          type="button"
          class={styles["month-nav-today"]}
          onClick={() => cal.goToToday()}
        >
          <Icon raw={refreshRaw} />
          <span>Aujourd'hui</span>
        </button>
      </Show>
    </div>
  );
}
