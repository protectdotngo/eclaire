import type { Alpine } from "alpinejs";
import Truncate from "@alpine-collective/toolkit-truncate";
import collapse from "@alpinejs/collapse";

export default (Alpine: Alpine) => {
  Alpine.plugin(Truncate);
  Alpine.plugin(collapse);
};
