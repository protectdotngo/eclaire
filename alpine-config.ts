import type { Alpine } from "alpinejs";
import Truncate from "@alpine-collective/toolkit-truncate";

export default (Alpine: Alpine) => {
    Alpine.plugin(Truncate);
};
