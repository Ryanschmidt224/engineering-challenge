import { initLessons } from "./lessons-learned.js?v=save-upload-20261128";
import { initSiteHeader } from "./site-header.js?v=offsite-backup-20261128";
import { initInformationCalculators } from "./calculators.js?v=offsite-backup-20261128";
initSiteHeader();
initLessons(document.getElementById("lessons-learned"));
initInformationCalculators(document.getElementById("calculators"));
