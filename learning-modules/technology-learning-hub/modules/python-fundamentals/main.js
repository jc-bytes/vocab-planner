import { mountFoundationModule } from "../../shared/foundation-module.js";
import { MODULE } from "./content.js";

MODULE.sections.filter((section) => section.practiceMode === "production").forEach((section) => { section.kind = "form"; });
mountFoundationModule(MODULE);
