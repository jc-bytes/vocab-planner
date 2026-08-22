import { mountFoundationModule } from "../../shared/foundation-module.js";
import { MODULE } from "./content.js";

mountFoundationModule(MODULE);

document.addEventListener("submit", (event) => {
  if (event.target.id !== "fm-choice-form" || event.target.querySelector('input[name="answer"]:checked')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const firstChoice = event.target.querySelector('input[name="answer"]');
  firstChoice.setCustomValidity("Choose an answer before saving."); firstChoice.reportValidity();
  firstChoice.addEventListener("change", () => firstChoice.setCustomValidity(""), { once: true });
}, true);
