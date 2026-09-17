// AutomationPlus — intégration Home Assistant custom
// Copyright (C) 2026  la12lab
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Panel AutomationPlus — squelette v0.1 (validation du mécanisme panel_custom).
// HA assigne directement les propriétés hass / narrow / panel sur l'élément,
// pas via des attributs HTML — d'où l'usage de set hass(value) plutôt que attributeChangedCallback.

import { BLOCK_REGISTRY_HA_VERSION, BLOCK_TYPES, WEEKDAY_ORDER, WEEKDAY_LABELS, buildDefaultBlock, describeTrigger, describeCondition, describeAction, getBlockFields, formatDuration, getDomainStates } from "./automation-blocks-catalog.js";

// Infos de debug — pas de pipeline de build pour l'instant, donc à tenir à
// jour manuellement en même temps que manifest.json. DEBUG_VERSION reste
// affiché dans le badge du header ; DEBUG_BUILD_DATE n'est plus dans le
// header (retiré sur demande) et sera affiché dans le futur bloc « À propos »
// de la page Réglages (pas encore codée).
const DEBUG_VERSION = "0.8.0-beta.8";
const DEBUG_BUILD_DATE = "2026-09-17";

const REPO_URL = "https://github.com/la12lab/ha-automation-plus";
const ISSUES_URL = `${REPO_URL}/issues`;
const RELEASES_URL = `${REPO_URL}/releases`;

// Profondeur de la pile Undo/Redo de la vue Liste (issue #90, lot 1). Un
// snapshot est un clone JSON de la config en cours d'édition (quelques Ko) —
// 50 entrées restent négligeables en mémoire pour un coût déjà accepté à
// chaque mutation (_editionMutateList clone déjà la liste concernée).
const EDITION_HISTORY_LIMIT = 50;

const GROUP_OPTIONS = [
  { id: "none", label: "Ne pas regrouper" },
  { id: "area", label: "Pièce" },
  { id: "category", label: "Catégorie" },
  { id: "state", label: "État" },
];

// Tri appliqué après le regroupement (à l'intérieur de chaque groupe s'il y
// en a un, ou sur la liste à plat sinon) — indépendant de GROUP_OPTIONS,
// voir _sortAutomations().
const SORT_OPTIONS = [
  { id: "none", label: "Ne pas trier" },
  { id: "name", label: "Nom" },
  { id: "area", label: "Pièce" },
  { id: "category", label: "Catégorie" },
  { id: "state", label: "État" },
];

const STATUS_FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "on", label: "Activées" },
  { id: "off", label: "Désactivées" },
];

// Couleur de repli pour une étiquette HA sans couleur définie.
const DEFAULT_LABEL_COLOR = "#6b7280";

// Préférences d'affichage du dashboard persistées côté navigateur
// (localStorage) — propres à cet appareil/navigateur, pas synchronisées
// entre appareils. Ne couvre volontairement pas la recherche texte, qui
// reste une saisie ponctuelle.
const PREFS_STORAGE_KEY = "automation_plus.dashboard_prefs";

// Chemins des routes HTTP de l'intégration (voir http.py / const.py côté
// Python — API_*_URL). hass.callApi() préfixe déjà "/api/", donc ces valeurs
// restent sans le préfixe ; auth/sign_path (téléchargement) le veut inclus,
// voir _exportAutomations().
const API_PATHS = {
  configCheck: "automation_plus/config_check",
  yamlCheck: "automation_plus/yaml_check",
  export: "automation_plus/export",
  settings: "automation_plus/settings",
  automations: "automation_plus/automations",
};

// Délai avant disparition automatique du toast d'erreur (fermeture manuelle
// via le bouton × toujours possible avant ce délai).
const ERROR_TOAST_AUTO_DISMISS_MS = 5000;

// Icônes en SVG inline (pas de dépendance CDN — le panel doit fonctionner
// sans accès internet sur une instance HA locale).
const ICON_ARROW_LEFT = `<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>`;
const ICON_BUG = `<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>`;
// Bouton désactivé (#76) tant qu'aucun contenu d'aide n'existe — voir le
// bouton "Aide" du header, pattern identique aux boutons "Bientôt
// disponible" de la page Réglages (title + attribut disabled).
const ICON_HELP_CIRCLE = `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`;
const ICON_SETTINGS =`<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`;
const ICON_SEARCH = `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`;
const ICON_LAYERS = `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`;

// Wordmark AutomationPlus (export Affinity Designer, régénéré à la main à
// chaque évolution du design) inliné pour pouvoir recolorer le texte
// "Automation" en currentColor (adaptatif au
// thème HA clair/sombre via --primary-text-color, comme l'était le <h1>
// texte qu'il remplace) — un <img src="..."> externe ne permettrait pas
// cette recoloration (currentColor ne traverse pas la frontière d'une
// image référencée). Le logo rond et le "Plus" gardent leur bleu de
// marque fixe, volontairement non recolorés.
const WORDMARK_SVG_INNER = `<g transform="matrix(0.138123,0,0,0.138273,4.526316,32.605505)">
        <path d="M1254,626.317L1254,627.683C1254,973.357 973.051,1254 627,1254C280.949,1254 0,973.357 0,627.683L0,626.317C0,280.643 280.949,0 627,0C973.051,0 1254,280.643 1254,626.317Z" style="fill:rgb(18,160,247);"/>
    </g>
    <g transform="matrix(0.14641,0,0,0.14657,86.799047,108.899083)">
        <g transform="matrix(1,0,0,1,-627,-627)">
            <g transform="matrix(1,0,0,1,0,131)">
                <circle cx="569.5" cy="172" r="49" style="fill:white;"/>
            </g>
            <g transform="matrix(1,0,0,1,-1,133)">
                <rect x="552" y="172" width="35" height="130" style="fill:white;"/>
            </g>
            <g transform="matrix(1,0,0,0.826087,0,173.043478)">
                <path d="M587.5,236C487,236 293,274 293,460L293,900C293,955 330,995 403,995L772,995C845,995 882,955 882,900L882,460C882,274 688,236 587.5,236Z" style="fill:white;fill-rule:nonzero;"/>
            </g>
            <path d="M270,610L270,750C270,768.765 254.765,784 236,784C217.235,784 202,768.765 202,750L202,610C202,591.235 217.235,576 236,576C254.765,576 270,591.235 270,610Z" style="fill:white;"/>
            <path d="M972,609L972,704C972,722.213 957.213,737 939,737L938,737C919.787,737 905,722.213 905,704L905,609C905,590.787 919.787,576 938,576L939,576C957.213,576 972,590.787 972,609Z" style="fill:white;"/>
            <circle cx="943" cy="930" r="162" style="fill:white;"/>
            <path d="M821,814.5C821,868.864 776.864,913 722.5,913L440.5,913C386.136,913 342,868.864 342,814.5C342,760.136 386.136,716 440.5,716L722.5,716C776.864,716 821,760.136 821,814.5Z" style="fill:rgb(4,74,136);"/>
            <circle cx="462.5" cy="815" r="45" style="fill:rgb(153,214,253);"/>
            <circle cx="705" cy="815" r="45" style="fill:rgb(153,214,253);"/>
            <path d="M965,834L965,1028C965,1033.519 960.519,1038 955,1038L929,1038C923.481,1038 919,1033.519 919,1028L919,834C919,828.481 923.481,824 929,824L955,824C960.519,824 965,828.481 965,834Z" style="fill:rgb(18,160,247);"/>
            <path d="M1049,917L1049,944C1049,949.519 1044.519,954 1039,954L846,954C840.481,954 836,949.519 836,944L836,917C836,911.481 840.481,907 846,907L1039,907C1044.519,907 1049,911.481 1049,917Z" style="fill:rgb(18,160,247);"/>
        </g>
    </g><g transform="matrix(1,0,0,1,182,154)">
        <g>
            <g transform="matrix(94,0,0,94,0,0)">
                <path d="M0.444,-0.294L0.335,-0.611L0.22,-0.294L0.444,-0.294ZM0.285,-0.717L0.395,-0.717L0.655,-0L0.548,-0L0.476,-0.215L0.192,-0.215L0.114,-0L0.015,-0L0.285,-0.717Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,62.697266,0)">
                <path d="M0.152,-0.523L0.152,-0.176C0.152,-0.149 0.157,-0.127 0.165,-0.11C0.181,-0.079 0.21,-0.063 0.252,-0.063C0.314,-0.063 0.355,-0.091 0.377,-0.146C0.389,-0.175 0.396,-0.215 0.396,-0.266L0.396,-0.523L0.483,-0.523L0.483,-0L0.4,-0L0.401,-0.077C0.39,-0.057 0.376,-0.041 0.359,-0.027C0.325,0 0.285,0.014 0.237,0.014C0.162,0.014 0.111,-0.011 0.084,-0.061C0.07,-0.087 0.062,-0.123 0.062,-0.167L0.062,-0.523L0.152,-0.523Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,114.975586,0)">
                <path d="M0.082,-0.669L0.171,-0.669L0.171,-0.523L0.254,-0.523L0.254,-0.451L0.171,-0.451L0.171,-0.11C0.171,-0.092 0.177,-0.079 0.189,-0.073C0.196,-0.07 0.208,-0.068 0.224,-0.068C0.228,-0.068 0.232,-0.068 0.237,-0.068C0.242,-0.068 0.248,-0.069 0.254,-0.069L0.254,-0C0.244,0.003 0.234,0.005 0.223,0.006C0.212,0.008 0.2,0.008 0.188,0.008C0.146,0.008 0.119,-0.002 0.104,-0.023C0.089,-0.044 0.082,-0.071 0.082,-0.105L0.082,-0.451L0.011,-0.451L0.011,-0.523L0.082,-0.523L0.082,-0.669Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,141.091797,0)">
                <path d="M0.272,-0.057C0.33,-0.057 0.37,-0.079 0.392,-0.123C0.413,-0.167 0.424,-0.216 0.424,-0.27C0.424,-0.319 0.417,-0.359 0.401,-0.389C0.376,-0.437 0.333,-0.461 0.273,-0.461C0.219,-0.461 0.18,-0.441 0.156,-0.4C0.131,-0.359 0.119,-0.309 0.119,-0.251C0.119,-0.196 0.131,-0.149 0.156,-0.112C0.18,-0.075 0.219,-0.057 0.272,-0.057ZM0.275,-0.538C0.343,-0.538 0.4,-0.516 0.446,-0.471C0.493,-0.426 0.516,-0.36 0.516,-0.272C0.516,-0.188 0.496,-0.118 0.455,-0.063C0.414,-0.008 0.35,0.019 0.264,0.019C0.192,0.019 0.135,-0.005 0.092,-0.054C0.05,-0.103 0.029,-0.168 0.029,-0.25C0.029,-0.338 0.051,-0.408 0.096,-0.46C0.14,-0.512 0.2,-0.538 0.275,-0.538Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,193.370117,0)">
                <path d="M0.064,-0.523L0.151,-0.523L0.151,-0.449C0.172,-0.474 0.191,-0.493 0.208,-0.505C0.237,-0.525 0.27,-0.535 0.307,-0.535C0.348,-0.535 0.382,-0.524 0.407,-0.504C0.422,-0.492 0.435,-0.475 0.446,-0.452C0.466,-0.48 0.489,-0.501 0.515,-0.514C0.542,-0.528 0.571,-0.535 0.604,-0.535C0.674,-0.535 0.722,-0.509 0.748,-0.458C0.761,-0.431 0.768,-0.394 0.768,-0.348L0.768,-0L0.677,-0L0.677,-0.363C0.677,-0.398 0.668,-0.422 0.651,-0.435C0.633,-0.448 0.612,-0.455 0.587,-0.455C0.552,-0.455 0.523,-0.443 0.498,-0.42C0.473,-0.397 0.46,-0.358 0.46,-0.304L0.46,-0L0.371,-0L0.371,-0.341C0.371,-0.377 0.367,-0.403 0.358,-0.419C0.345,-0.443 0.32,-0.456 0.284,-0.456C0.25,-0.456 0.22,-0.443 0.193,-0.417C0.166,-0.391 0.152,-0.345 0.152,-0.277L0.152,-0L0.064,-0L0.064,-0.523Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,271.672852,0)">
                <path d="M0.132,-0.139C0.132,-0.114 0.141,-0.094 0.16,-0.079C0.178,-0.064 0.2,-0.057 0.226,-0.057C0.257,-0.057 0.286,-0.064 0.315,-0.079C0.364,-0.102 0.389,-0.141 0.389,-0.195L0.389,-0.266C0.378,-0.259 0.364,-0.254 0.347,-0.249C0.33,-0.244 0.314,-0.241 0.297,-0.239L0.244,-0.232C0.212,-0.228 0.188,-0.222 0.172,-0.212C0.145,-0.197 0.132,-0.173 0.132,-0.139ZM0.345,-0.317C0.365,-0.319 0.378,-0.328 0.385,-0.342C0.389,-0.35 0.391,-0.361 0.391,-0.376C0.391,-0.406 0.38,-0.428 0.359,-0.441C0.338,-0.455 0.307,-0.461 0.268,-0.461C0.222,-0.461 0.189,-0.449 0.17,-0.424C0.159,-0.411 0.152,-0.39 0.149,-0.363L0.067,-0.363C0.069,-0.428 0.089,-0.473 0.13,-0.498C0.17,-0.523 0.216,-0.536 0.27,-0.536C0.331,-0.536 0.381,-0.524 0.419,-0.5C0.458,-0.477 0.477,-0.441 0.477,-0.391L0.477,-0.09C0.477,-0.081 0.478,-0.073 0.482,-0.068C0.486,-0.062 0.494,-0.06 0.506,-0.06C0.51,-0.06 0.514,-0.06 0.519,-0.06C0.524,-0.061 0.529,-0.062 0.535,-0.062L0.535,0.002C0.521,0.006 0.511,0.009 0.503,0.01C0.496,0.011 0.486,0.011 0.474,0.011C0.444,0.011 0.422,0 0.408,-0.021C0.401,-0.032 0.396,-0.049 0.393,-0.069C0.375,-0.046 0.349,-0.026 0.316,-0.008C0.282,0.009 0.245,0.018 0.205,0.018C0.157,0.018 0.117,0.003 0.086,-0.027C0.055,-0.056 0.04,-0.093 0.04,-0.137C0.04,-0.186 0.055,-0.223 0.085,-0.25C0.116,-0.277 0.155,-0.293 0.205,-0.299L0.345,-0.317Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,323.951172,0)">
                <path d="M0.082,-0.669L0.171,-0.669L0.171,-0.523L0.254,-0.523L0.254,-0.451L0.171,-0.451L0.171,-0.11C0.171,-0.092 0.177,-0.079 0.189,-0.073C0.196,-0.07 0.208,-0.068 0.224,-0.068C0.228,-0.068 0.232,-0.068 0.237,-0.068C0.242,-0.068 0.248,-0.069 0.254,-0.069L0.254,-0C0.244,0.003 0.234,0.005 0.223,0.006C0.212,0.008 0.2,0.008 0.188,0.008C0.146,0.008 0.119,-0.002 0.104,-0.023C0.089,-0.044 0.082,-0.071 0.082,-0.105L0.082,-0.451L0.011,-0.451L0.011,-0.523L0.082,-0.523L0.082,-0.669Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,350.067383,0)">
                <path d="M0.064,-0.521L0.154,-0.521L0.154,-0L0.064,-0L0.064,-0.521ZM0.064,-0.717L0.154,-0.717L0.154,-0.618L0.064,-0.618L0.064,-0.717Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,370.951172,0)">
                <path d="M0.272,-0.057C0.33,-0.057 0.37,-0.079 0.392,-0.123C0.413,-0.167 0.424,-0.216 0.424,-0.27C0.424,-0.319 0.417,-0.359 0.401,-0.389C0.376,-0.437 0.333,-0.461 0.273,-0.461C0.219,-0.461 0.18,-0.441 0.156,-0.4C0.131,-0.359 0.119,-0.309 0.119,-0.251C0.119,-0.196 0.131,-0.149 0.156,-0.112C0.18,-0.075 0.219,-0.057 0.272,-0.057ZM0.275,-0.538C0.343,-0.538 0.4,-0.516 0.446,-0.471C0.493,-0.426 0.516,-0.36 0.516,-0.272C0.516,-0.188 0.496,-0.118 0.455,-0.063C0.414,-0.008 0.35,0.019 0.264,0.019C0.192,0.019 0.135,-0.005 0.092,-0.054C0.05,-0.103 0.029,-0.168 0.029,-0.25C0.029,-0.338 0.051,-0.408 0.096,-0.46C0.14,-0.512 0.2,-0.538 0.275,-0.538Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,423.229492,0)">
                <path d="M0.064,-0.523L0.148,-0.523L0.148,-0.449C0.173,-0.479 0.199,-0.501 0.227,-0.515C0.254,-0.528 0.285,-0.535 0.319,-0.535C0.393,-0.535 0.443,-0.509 0.469,-0.457C0.484,-0.429 0.491,-0.388 0.491,-0.335L0.491,-0L0.401,-0L0.401,-0.33C0.401,-0.361 0.397,-0.387 0.387,-0.407C0.372,-0.439 0.343,-0.456 0.302,-0.456C0.281,-0.456 0.264,-0.453 0.251,-0.449C0.227,-0.442 0.206,-0.428 0.188,-0.406C0.173,-0.389 0.163,-0.371 0.159,-0.353C0.155,-0.334 0.152,-0.308 0.152,-0.274L0.152,-0L0.064,-0L0.064,-0.523Z" style="fill:currentColor;fill-rule:nonzero;"/>
            </g>
        </g>
        <g>
            <g transform="matrix(94,0,0,94,475.507812,0)">
                <path d="M0.382,-0.259L0.229,-0.259L0.229,-0L0.08,-0L0.08,-0.72L0.393,-0.72C0.465,-0.72 0.523,-0.701 0.566,-0.664C0.609,-0.627 0.63,-0.569 0.63,-0.492C0.63,-0.407 0.609,-0.347 0.566,-0.312C0.523,-0.276 0.462,-0.259 0.382,-0.259ZM0.452,-0.409C0.472,-0.426 0.481,-0.453 0.481,-0.491C0.481,-0.528 0.472,-0.555 0.452,-0.571C0.432,-0.587 0.405,-0.595 0.369,-0.595L0.229,-0.595L0.229,-0.383L0.369,-0.383C0.405,-0.383 0.432,-0.391 0.452,-0.409Z" style="fill:rgb(18,160,247);fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,538.205078,0)">
                <rect x="0.068" y="-0.72" width="0.139" height="0.72" style="fill:rgb(18,160,247);fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,564.321289,0)">
                <path d="M0.406,-0.075C0.405,-0.074 0.402,-0.069 0.396,-0.061C0.391,-0.052 0.385,-0.045 0.378,-0.039C0.356,-0.02 0.335,-0.006 0.315,0.001C0.294,0.008 0.271,0.012 0.243,0.012C0.164,0.012 0.111,-0.017 0.084,-0.073C0.069,-0.104 0.061,-0.151 0.061,-0.211L0.061,-0.532L0.204,-0.532L0.204,-0.211C0.204,-0.181 0.207,-0.158 0.214,-0.143C0.227,-0.116 0.252,-0.103 0.289,-0.103C0.337,-0.103 0.369,-0.122 0.387,-0.16C0.396,-0.181 0.4,-0.208 0.4,-0.243L0.4,-0.532L0.542,-0.532L0.542,-0L0.406,-0L0.406,-0.075Z" style="fill:rgb(18,160,247);fill-rule:nonzero;"/>
            </g>
            <g transform="matrix(94,0,0,94,621.740234,0)">
                <path d="M0.432,-0.508C0.473,-0.481 0.497,-0.435 0.503,-0.37L0.364,-0.37C0.362,-0.388 0.357,-0.402 0.349,-0.413C0.334,-0.431 0.308,-0.441 0.271,-0.441C0.241,-0.441 0.219,-0.436 0.206,-0.427C0.193,-0.417 0.187,-0.406 0.187,-0.394C0.187,-0.378 0.194,-0.366 0.208,-0.359C0.221,-0.351 0.27,-0.339 0.353,-0.32C0.408,-0.307 0.449,-0.288 0.477,-0.261C0.504,-0.235 0.518,-0.201 0.518,-0.161C0.518,-0.108 0.498,-0.065 0.459,-0.032C0.42,0.001 0.359,0.018 0.277,0.018C0.194,0.018 0.132,0 0.092,-0.035C0.052,-0.07 0.032,-0.115 0.032,-0.17L0.173,-0.17C0.176,-0.145 0.183,-0.128 0.192,-0.117C0.21,-0.099 0.242,-0.089 0.288,-0.089C0.315,-0.089 0.337,-0.093 0.353,-0.102C0.369,-0.11 0.377,-0.122 0.377,-0.138C0.377,-0.154 0.371,-0.166 0.358,-0.174C0.345,-0.182 0.297,-0.196 0.213,-0.216C0.153,-0.231 0.11,-0.25 0.085,-0.272C0.061,-0.294 0.048,-0.326 0.048,-0.368C0.048,-0.417 0.068,-0.459 0.106,-0.494C0.145,-0.53 0.199,-0.547 0.269,-0.547C0.335,-0.547 0.39,-0.534 0.432,-0.508Z" style="fill:rgb(18,160,247);fill-rule:nonzero;"/>
            </g>
        </g>
    </g>`;
const ICON_CHEVRON_DOWN = `<path d="m6 9 6 6 6-6"/>`;
const ICON_CHECK = `<path d="M20 6 9 17l-5-5"/>`;
const ICON_PLUS = `<path d="M5 12h14"/><path d="M12 5v14"/>`;
const ICON_FOLDER = `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`;
const ICON_MAP_PIN = `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`;
const ICON_ALERT_TRIANGLE = `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`;
const ICON_X = `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`;
const ICON_FILE_TEXT = `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`;
const ICON_SHIELD_CHECK = `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.79 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>`;
const ICON_DOWNLOAD = `<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>`;
const ICON_UPLOAD = `<path d="M12 3v12"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/>`;
const ICON_SCROLL_TEXT = `<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>`;
// Bloc Raccourcis de la page Réglages (issue #82) : liens vers les pages
// natives HA de gestion des étiquettes/pièces.
const ICON_TAGS = `<path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/><path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/><circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/>`;
const ICON_SOFA = `<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/>`;
const ICON_EXTERNAL_LINK = `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`;
const ICON_INFO = `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`;
const ICON_EDIT = `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`;
const ICON_COPY = `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`;
const ICON_TOGGLE_LEFT = `<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="8" cy="12" r="2"/>`;
const ICON_TOGGLE_RIGHT = `<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/>`;
const ICON_TRASH = `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`;
const ICON_MORE_VERTICAL = `<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>`;
const ICON_ARROW_UP_DOWN = `<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>`;
// Page Édition, mode Code (issue #87) — sélecteur de vue (Liste/Graphe/Code)
// et bandeau lecture seule.
const ICON_LIST = `<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>`;
const ICON_GIT_FORK = `<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/>`;
// En-têtes des 3 groupes de la vue Édition Liste (#5) : Déclencheur/Condition/Action.
const ICON_ZAP = `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`;
const ICON_GIT_BRANCH = `<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>`;
const ICON_PLAY = `<polygon points="6 3 20 12 6 21 6 3"/>`;
const ICON_GRIP_VERTICAL = `<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>`;
const ICON_FILE_CODE = `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/>`;
const ICON_LOCK = `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`;
const ICON_UNDO_2 = `<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>`;
const ICON_REDO_2 = `<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>`;
const ICON_REFRESH_CW = `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Le nommage HA du champ liste (singulier vs pluriel) a changé selon les
// versions (voir _stringifyYaml plus bas et ARCHITECTURE.md §8) — on essaie
// les deux plutôt que de supposer l'un ou l'autre. Un objet unique (pas de
// liste) reste possible en YAML HA, normalisé ici en tableau à un élément.
function pickList(config, singularKey, pluralKey) {
  const raw = config[pluralKey] ?? config[singularKey];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// Clés singulier/pluriel HA par catégorie de bloc (page Édition, vue
// Liste) — utilisé à la fois pour lire (pickList) et pour écrire
// (_editionMutateList, issue #101) une liste trigger(s)/condition(s)/
// action(s).
const EDITION_LIST_KEYS = {
  trigger: ["trigger", "triggers"],
  condition: ["condition", "conditions"],
  action: ["action", "actions"],
};

const EDITION_CATEGORY_LABELS = {
  trigger: "Déclencheur",
  condition: "Condition",
  action: "Action",
};

// Onglets du switcher de catégories de la Sidebar Palette (issue #102,
// ajustement post-review) — un seul onglet actif affiché à la fois plutôt
// que les 3 sections empilées, design calqué sur le switcher Liste/Graphe/
// Code de la toolbar Édition (.edition-segment/.edition-view-selector).
const EDITION_PALETTE_TABS = [
  { category: "trigger", icon: ICON_ZAP, label: "Déclencheurs", sectionTitle: "DÉCLENCHEURS" },
  { category: "condition", icon: ICON_GIT_BRANCH, label: "Conditions", sectionTitle: "CONDITIONS" },
  { category: "action", icon: ICON_PLAY, label: "Actions", sectionTitle: "ACTIONS" },
];

// Boutons "Aller à" de la Sidebar de la vue Code (issue #112) — même icônes
// que la Palette de la vue Liste, labels au singulier (cohérent avec
// EDITION_CATEGORY_LABELS et le design validé dans le .pen).
const EDITION_CODE_GOTO_ITEMS = [
  { category: "trigger", icon: ICON_ZAP },
  { category: "condition", icon: ICON_GIT_BRANCH },
  { category: "action", icon: ICON_PLAY },
];

// Valide `label.color` (issu du label_registry HA) avant interpolation dans
// un attribut `style` — escapeHtml() bloque la sortie de l'attribut mais pas
// une valeur CSS malformée (ex. "red;background:...") qui casserait le rendu
// de la chip (issue #71). Motif restrictif : hex #rgb/#rrggbb ou nom CSS/HA
// simple (lettres + tirets, ex. "deep-orange") — au moindre doute on retombe
// sur la couleur par défaut plutôt que de risquer d'interpoler quoi que ce
// soit d'inattendu.
const SAFE_CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z][a-zA-Z-]*)$/;

// La palette de couleurs nommées de HA (sélecteur de couleur des labels)
// inclut des noms composés ("deep-orange", "light-blue", "blue-grey"...) qui
// ne sont PAS des mots-clés CSS valides — seuls les noms simples ("red",
// "orange", "teal"...) le sont par coïncidence. HA les résout via une
// variable CSS `--{nom}-color` définie globalement par son thème (voir
// `computeCssColor()` dans home-assistant-frontend) ; on applique le même
// mécanisme ici plutôt que d'interpoler le nom brut, qui échouait
// silencieusement pour tout nom composé (retombait visuellement sur aucune
// couleur, alors que safeLabelColor() avait pourtant validé la valeur).
//
// Filet de secours si cette variable CSS n'est pas définie (thème
// personnalisé minimal qui ne la reprendrait pas) : valeurs hex exactes du
// thème clair HA (`color.globals.ts`, home-assistant-frontend) plutôt que la
// couleur grise par défaut — ne sert que dans ce cas résiduel, le mécanisme
// var() ci-dessus reste prioritaire et s'adapte lui au thème clair/sombre.
const HA_NAMED_COLORS = {
  red: "#f44336",
  pink: "#e91e63",
  purple: "#926bc7",
  "deep-purple": "#6e41ab",
  indigo: "#3f51b5",
  blue: "#2196f3",
  "light-blue": "#03a9f4",
  cyan: "#00bcd4",
  teal: "#009688",
  green: "#4caf50",
  "light-green": "#8bc34a",
  lime: "#cddc39",
  yellow: "#ffeb3b",
  amber: "#ffc107",
  orange: "#ff9800",
  "deep-orange": "#ff6f22",
  brown: "#795548",
  "light-grey": "#bdbdbd",
  grey: "#9e9e9e",
  "dark-grey": "#606060",
  "blue-grey": "#607d8b",
  black: "#000000",
  white: "#ffffff",
  disabled: "#bdbdbd",
};

function safeLabelColor(color) {
  if (typeof color !== "string" || !SAFE_CSS_COLOR_RE.test(color)) return DEFAULT_LABEL_COLOR;
  if (color.startsWith("#")) return color;
  return `var(--${color}-color, ${HA_NAMED_COLORS[color] || DEFAULT_LABEL_COLOR})`;
}

class AutomationPlusPanel extends HTMLElement {
  constructor() {
    super();
    // "dashboard" (par défaut) ou "settings" — état interne, pas de routeur :
    // pas de bundler dans ce projet, la page Réglages est un état du même
    // custom element plutôt qu'un composant séparé (voir ARCHITECTURE.md §5).
    this._view = "dashboard";
    this._configCheckState = { loading: false, result: null, error: false };
    this._yamlCheckState = { loading: false, files: null, error: false, checkedAt: null };

    const prefs = this._loadPrefs();
    this._filterText = "";
    this._statusFilter = prefs.statusFilter;
    this._activeLabelFilters = new Set(prefs.activeLabelFilters);
    this._groupBy = prefs.groupBy;
    this._groupMenuOpen = false;
    this._sortBy = prefs.sortBy;
    this._sortMenuOpen = false;
    // entity_id des automatisations dont le toggle est en attente de
    // confirmation par HA — évite un double clic pendant l'aller-retour
    // service call / mise à jour d'état.
    this._pendingToggles = new Set();
    // Toast d'erreur affiché uniquement en cas d'échec d'une action (ex.
    // toggle) — jamais de bannière de confirmation en cas de succès, le
    // changement visuel (ex. position du toggle) suffit déjà comme feedback.
    this._errorToast = null;
    this._errorToastTimeoutId = null;

    // Menu Options (kebab) : entity_id de la ligne dont le menu est ouvert,
    // un seul à la fois — null si aucun.
    this._optionsMenuOpenFor = null;
    // Popup de confirmation de suppression : entity_id ciblé, ou null.
    this._deleteConfirmFor = null;
    this._deleteInProgress = false;
    // Popup Détail (menu Options > Détail) : entity_id ciblé + brouillon des champs en
    // cours d'édition (copie modifiable, jamais écrite tant que non
    // enregistrée), ou null si le popup est fermé.
    this._detailPopupFor = null;
    this._detailDraft = null;
    this._detailSaving = false;
    // Mode de stockage actif (issue backend, voir AutomationPlusSettingsView)
    // — conditionne l'item "Télécharger" du menu kebab (dossier dédié
    // uniquement). Chargé une fois au premier hass, voir _loadStorageMode().
    this._storageMode = null;

    // Registres HA (entity/area/label/category) — chargés une seule fois
    // par connexion hass via WebSocket, voir _loadRegistries().
    this._entityRegistryByEntityId = new Map();
    this._areaRegistry = new Map();
    this._labelRegistry = new Map();
    this._categoryRegistry = new Map();
    this._registriesLoaded = false;
    this._registriesLoading = false;

    // Snapshot (state|friendly_name|icon) des entités automation.* au
    // dernier rendu réel — permet à set hass() de sauter le re-render
    // complet quand rien de visible n'a changé, voir _automationSnapshot().
    this._lastAutomationSnapshot = null;

    // Page Édition, mode Code (lecture seule — issue #87) : automatisation
    // ciblée (objet enrichi, voir _getAutomations()) et état du YAML
    // chargé/sérialisé côté client. Rechargé à chaque ouverture, jamais mis
    // en cache d'une automatisation à l'autre. Graphe/Déverrouiller/
    // Enregistrer restent hors périmètre (issues #86/#88/#89). Undo/Redo de
    // la vue Liste : voir issue #90.
    this._editionAutomation = null;
    this._editionYaml = { loading: false, lines: null, config: null, error: null };
    this._editionHelpOpen = false;
    // Vue par défaut de la page Édition : Liste, cf. issue #5. Code reste
    // disponible comme onglet secondaire, chargé en lazy (voir _loadEditionYaml).
    this._editionSubView = "liste";
    // Panneau Paramètres fonctionnel (issue #101) : bloc sélectionné dans la
    // Zone Centrale (chemin plat {category, index}, pas de chemin imbriqué —
    // les blocs composites choose/if ne sont affichés que comme une seule
    // carte, cf. plan). Écriture en mémoire uniquement dans
    // this._editionYaml.config, jamais persistée (dépend de #88/#89/#92).
    // _editionDirty (accesseur plus bas) et les indicateurs "modifié" (carte
    // + liseré de groupe) sont TOUS dérivés par comparaison de contenu avec
    // _editionOriginalConfig (photo de la config au chargement) plutôt que
    // des drapeaux "a été touché une fois" — sinon revenir à l'état d'origine
    // (dupliquer puis supprimer, activer puis désactiver...) laisserait le
    // violet affiché à tort (retour utilisateur, issue #105). Voir
    // _editionCategoryChanged()/_editionIsBlockModified(). _editionBlockOriginMap
    // fait correspondre chaque index courant à son index d'origine (ou null
    // si le bloc n'existait pas à l'origine, ex: duplication) — nécessaire
    // car les blocs HA n'ont pas d'identifiant stable, seulement une
    // position dans la liste, qui se décale à chaque insertion/suppression.
    this._selectedBlock = null;
    this._editionOriginalConfig = null;
    this._editionBlockOriginMap = { trigger: [], condition: [], action: [] };
    // Historique Undo/Redo de la vue Liste (issue #90, lot 1) : pile de
    // snapshots {config, originMap, selectedBlock} alimentée en tête de
    // _editionMutateList (point d'interception unique de toutes les
    // mutations de blocs). _editionHistoryMuted évite qu'une restauration
    // (_editionRestoreSnapshot) ne s'auto-empile si elle repasse par
    // _editionMutateList. Limite de profondeur : EDITION_HISTORY_LIMIT.
    this._editionHistory = { past: [], future: [] };
    this._editionHistoryMuted = false;
    // Sidebar "Aller à" de la vue Code (issue #112, ajustement post-review) :
    // sélection PERSISTANTE (retour utilisateur explicite — pas un état
    // transitoire) — reclique sur le même bouton pour désélectionner, un
    // seul actif à la fois (cliquer un autre bouton bascule directement).
    // Dérivé dans _renderEditionCode()/_renderEditionCodeSidebar() à chaque
    // render, jamais de manipulation DOM directe hors render. Recherche
    // YAML (même issue) : champ de la sidebar déjà présent dans le .pen
    // (résidu "Palette" en apparence, en réalité prévu pour cette vue).
    this._editionCodeActiveCategory = null;
    this._editionCodeSearchQuery = "";
    // Menu kebab par bloc (Dupliquer/Activer-Désactiver/Supprimer, issue
    // #105) — un seul ouvert à la fois, même pattern que
    // _optionsMenuOpenFor (menu Options automatisation du Dashboard).
    this._editionBlockMenuOpenFor = null;
    // Requête de la recherche palette (issue #102) — persiste à travers un
    // _render() complet, remise à zéro seulement à l'ouverture d'une autre
    // automatisation (_openEdition).
    this._editionPaletteQuery = "";
    // Onglet actif du switcher de catégories de la palette (issue #102,
    // ajustement post-review) — ignoré tant qu'une recherche est en cours
    // (voir _renderEditionPaletteSections()).
    this._editionPaletteActiveCategory = "trigger";
  }

  // _editionDirty (accesseur, pas un champ) : vrai si au moins une des 3
  // catégories diffère de _editionOriginalConfig — pilote le bandeau, le
  // bouton Annuler et (indirectement) Enregistrer en vue Liste.
  get _editionDirty() {
    return this._editionCategoryChanged("trigger") || this._editionCategoryChanged("condition") || this._editionCategoryChanged("action");
  }

  // Compare le CONTENU de la liste courante d'une catégorie à celui
  // d'origine (via pickList des deux côtés, donc insensible au renommage
  // singulier→pluriel de _editionMutateList — une simple comparaison de
  // config brute confondrait ce renommage assumé avec une vraie modification
  // de contenu). Alimente le liseré de groupe ET l'accesseur _editionDirty.
  _editionCategoryChanged(category) {
    const state = this._editionYaml;
    if (!state || !state.config || !this._editionOriginalConfig) return false;
    const [singular, plural] = EDITION_LIST_KEYS[category];
    const current = pickList(state.config, singular, plural);
    const original = pickList(this._editionOriginalConfig, singular, plural);
    return JSON.stringify(current) !== JSON.stringify(original);
  }

  // Un bloc est "modifié" si sa contrepartie d'origine (via
  // _editionBlockOriginMap) n'existe pas (bloc ajouté/dupliqué, toujours
  // considéré modifié — il n'existait pas avant), si sa POSITION diffère de
  // celle d'origine (issue #110, retour utilisateur : un glisser-déposer pur
  // ne change aucun contenu, donc sans ce cas le seul signal visuel restant
  // était le liseré de groupe — 1px, imperceptible en pratique) ou si son
  // contenu diffère de cette contrepartie. Alimente le liseré + la bordure
  // violette de la carte (issue #105).
  _editionIsBlockModified(category, index, block) {
    const map = this._editionBlockOriginMap[category];
    const originalIndex = map ? map[index] : undefined;
    if (originalIndex === undefined) return false;
    if (originalIndex === null) return true;
    if (originalIndex !== index) return true;
    const [singular, plural] = EDITION_LIST_KEYS[category];
    const original = (this._editionOriginalConfig ? pickList(this._editionOriginalConfig, singular, plural) : [])[originalIndex];
    return JSON.stringify(block) !== JSON.stringify(original);
  }

  // Instantané minimal des entités automation.* pertinentes pour le rendu
  // (voir _getAutomations()) — sert uniquement à détecter si un re-render
  // est nécessaire, jamais utilisé comme source de données pour l'affichage.
  _automationSnapshot(hass) {
    const snapshot = new Map();
    if (!hass || !hass.states) return snapshot;
    for (const stateObj of Object.values(hass.states)) {
      if (!stateObj.entity_id.startsWith("automation.")) continue;
      const attributes = stateObj.attributes || {};
      snapshot.set(stateObj.entity_id, `${stateObj.state}|${attributes.friendly_name || ""}|${attributes.icon || ""}`);
    }
    return snapshot;
  }

  // Compare deux snapshots _automationSnapshot() — true si identiques
  // (mêmes clés, mêmes valeurs).
  _snapshotsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [entityId, value] of a) {
      if (b.get(entityId) !== value) return false;
    }
    return true;
  }

  // localStorage peut échouer (navigation privée, stockage désactivé) —
  // dans ce cas le dashboard reste utilisable, seul le rappel des
  // préférences est perdu.
  _loadPrefs() {
    const defaults = { groupBy: "none", sortBy: "none", statusFilter: "all", activeLabelFilters: [] };
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        groupBy: GROUP_OPTIONS.some((option) => option.id === parsed.groupBy) ? parsed.groupBy : defaults.groupBy,
        sortBy: SORT_OPTIONS.some((option) => option.id === parsed.sortBy) ? parsed.sortBy : defaults.sortBy,
        statusFilter: STATUS_FILTERS.some((filter) => filter.id === parsed.statusFilter)
          ? parsed.statusFilter
          : defaults.statusFilter,
        activeLabelFilters: Array.isArray(parsed.activeLabelFilters)
          ? parsed.activeLabelFilters.filter((id) => typeof id === "string")
          : defaults.activeLabelFilters,
      };
    } catch (err) {
      return defaults;
    }
  }

  _savePrefs() {
    try {
      localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({
          groupBy: this._groupBy,
          sortBy: this._sortBy,
          statusFilter: this._statusFilter,
          activeLabelFilters: [...this._activeLabelFilters],
        })
      );
    } catch (err) {
      // Stockage indisponible — pas bloquant, on continue sans persister.
    }
  }

  set hass(value) {
    const isFirstAssignment = !this._hass;
    this._hass = value;

    // Élévation carte/ligne dérivée du thème (voir --ap-surface dans
    // _render) : nécessite de savoir si HA est en mode sombre. Appliqué sur
    // la classList du host indépendamment du re-render conditionnel
    // ci-dessous (snapshot d'automatisations) pour rester à jour même quand
    // seul le thème change.
    this.classList.toggle("ap-dark", !!value?.themes?.darkMode);

    // HA réassigne hass à chaque changement d'état de n'importe quelle
    // entité de l'installation, pas seulement les automatisations — un
    // _renderPreservingFocus() complet à chaque fois recrée .scroll-area et
    // casse l'inertie du scroll (trackpad Mac, momentum tactile iPad). On ne
    // re-render que si un changement visible pour ce panel a réellement eu
    // lieu, voir _automationSnapshot()/_snapshotsEqual().
    const snapshot = this._automationSnapshot(value);
    const snapshotChanged = !this._lastAutomationSnapshot || !this._snapshotsEqual(this._lastAutomationSnapshot, snapshot);
    if (!isFirstAssignment && !snapshotChanged) {
      return;
    }
    this._lastAutomationSnapshot = snapshot;

    // .options-menu (position: fixed, voir _positionOptionsMenu) n'est
    // repositionné qu'au clic d'ouverture — un re-render déclenché par hass
    // le recrée sans coordonnées (saut visuel) ou fait rejouer la
    // restauration de scrollTop (voir _renderPreservingFocus) qui déclenche
    // à tort l'écouteur de fermeture au scroll. On ferme donc le menu de
    // façon proactive à chaque re-render décidé ici plutôt que de compter
    // sur ces effets de bord.
    this._optionsMenuOpenFor = null;

    this._renderPreservingFocus();
    if (isFirstAssignment) {
      this._loadRegistries();
      this._loadStorageMode();
    }
  }

  // HA réassigne `hass` à chaque changement d'état dans l'instance (pas
  // seulement sur les automatisations), donc très fréquemment. Un _render()
  // complet recrée le champ de recherche à chaque fois et lui fait perdre le
  // focus pendant la frappe — on sauvegarde donc le focus/la sélection avant
  // de re-render et on les restaure juste après.
  _renderPreservingFocus() {
    const root = this.shadowRoot;
    const active = root && root.activeElement;
    // Généralisé à tout champ actif portant `data-field` (issue #72), pas
    // seulement `.search-input` : le popup Détail (nom, icône, sélecteurs
    // pièce/catégorie/étiquette) recrée aussi ses champs à chaque
    // _render(), avec la même perte de focus/caret pendant la frappe.
    const activeSelector = active && active.classList.contains("search-input")
      ? ".search-input"
      : active && active.dataset && active.dataset.field
        ? `[data-field="${active.dataset.field}"]`
        : null;
    const canSelectRange = !!active && typeof active.selectionStart === "number";
    const selectionStart = canSelectRange ? active.selectionStart : null;
    const selectionEnd = canSelectRange ? active.selectionEnd : null;
    // Zone scrollable de la vue active (header/toolbar figés, voir CSS
    // `.scroll-area`/`.settings-view`) — un _render() complet la recrée et
    // remet son scroll à 0 à chaque réassignation de `hass`, aussi gênant
    // que la perte de focus du champ recherche ci-dessus.
    const scrollSelector = this._view === "settings" ? ".settings-view" : ".scroll-area";
    const previousScrollEl = root && root.querySelector(scrollSelector);
    const scrollTop = previousScrollEl ? previousScrollEl.scrollTop : 0;
    this._render();
    if (activeSelector) {
      const input = root.querySelector(activeSelector);
      if (input) {
        input.focus();
        if (canSelectRange && typeof input.setSelectionRange === "function") {
          input.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }
    const newScrollEl = root && root.querySelector(scrollSelector);
    if (newScrollEl) {
      newScrollEl.scrollTop = scrollTop;
    }
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this._render();
  }

  // Annule le timer du toast d'erreur (5s, voir _showErrorToast()) si le
  // panel est détruit pendant ce délai — sinon le callback s'exécute sur un
  // élément déjà détaché du DOM.
  disconnectedCallback() {
    if (this._errorToastTimeoutId) {
      clearTimeout(this._errorToastTimeoutId);
      this._errorToastTimeoutId = null;
    }
  }

  // Charge une seule fois les registres HA nécessaires pour enrichir la
  // liste des automatisations (pièce, catégorie, étiquettes) — hass.states
  // seul ne donne que le nom et l'état on/off.
  async _loadRegistries() {
    if (!this._hass || this._registriesLoading) return;
    this._registriesLoading = true;
    try {
      const [entities, areas, labels, categories] = await Promise.all([
        this._hass.callWS({ type: "config/entity_registry/list" }),
        this._hass.callWS({ type: "config/area_registry/list" }),
        this._hass.callWS({ type: "config/label_registry/list" }),
        this._hass.callWS({ type: "config/category_registry/list", scope: "automation" }),
      ]);
      this._entityRegistryByEntityId = new Map(entities.map((entry) => [entry.entity_id, entry]));
      this._areaRegistry = new Map(areas.map((area) => [area.area_id, area]));
      this._labelRegistry = new Map(labels.map((label) => [label.label_id, label]));
      this._categoryRegistry = new Map(categories.map((category) => [category.category_id, category]));
      this._registriesLoaded = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec du chargement des registres HA", err);
    } finally {
      this._registriesLoading = false;
      // _renderPreservingFocus() plutôt que _render() (issue #59 → #72) :
      // depuis que _openDetailPopup() relance ce chargement, sa résolution
      // peut désormais arriver pendant que l'utilisateur tape déjà dans le
      // popup Détail ouvert entretemps — un _render() nu y recréerait les
      // champs et ferait perdre focus/caret, exactement le bug de #72.
      this._renderPreservingFocus();
    }
  }

  // Mode de stockage actif (fichier standard / dossier dédié) — conditionne
  // l'item "Télécharger" du menu Options de chaque ligne. Silencieux en cas
  // d'échec : reste au défaut STORAGE_MODE_STANDARD-like (null -> "Télécharger"
  // inactif), pas de toast pour un chargement en arrière-plan non déclenché
  // par une action utilisateur.
  async _loadStorageMode() {
    if (!this._hass) return;
    try {
      const result = await this._hass.callApi("GET", API_PATHS.settings);
      this._storageMode = result.storage_mode;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec du chargement du mode de stockage", err);
    } finally {
      this._render();
    }
  }

  _icon(paths, size = 16) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  // Construit la liste des automatisations à partir de hass.states, enrichie
  // avec les registres (pièce, catégorie, étiquettes). Ne dépend pas du mode
  // de stockage choisi dans Réglages (fichier standard / dossier dédié) :
  // hass.states reflète toujours ce que HA a chargé, quelle que soit la source.
  _getAutomations() {
    if (!this._hass) return [];
    return Object.values(this._hass.states)
      .filter((stateObj) => stateObj.entity_id.startsWith("automation."))
      .map((stateObj) => {
        const entry = this._entityRegistryByEntityId.get(stateObj.entity_id);
        const areaId = entry ? entry.area_id : null;
        const categoryId = entry && entry.categories ? entry.categories.automation : null;
        const labelIds = entry ? entry.labels || [] : [];
        const area = areaId ? this._areaRegistry.get(areaId) : null;
        const category = categoryId ? this._categoryRegistry.get(categoryId) : null;
        const labels = labelIds
          .map((id) => this._labelRegistry.get(id))
          .filter(Boolean)
          .map((label) => ({ id: label.label_id, name: label.name, color: label.color, icon: label.icon }));
        return {
          entity_id: stateObj.entity_id,
          // Identifiant interne de l'automatisation (unique_id de l'entrée
          // registre == id utilisé par /api/config/automation/config/<id> et
          // par les noms de fichier <id>.yaml en mode dossier dédié) — requis
          // pour Détail/Dupliquer/Supprimer/Télécharger, distinct de entity_id.
          id: entry ? entry.unique_id : null,
          name: (stateObj.attributes && stateObj.attributes.friendly_name) || stateObj.entity_id,
          icon: (stateObj.attributes && stateObj.attributes.icon) || null,
          state: stateObj.state,
          area_id: areaId || null,
          area: area ? area.name : null,
          category_id: categoryId || null,
          category: category ? category.name : null,
          label_ids: labelIds,
          labels,
        };
      });
  }

  // Étiquettes réellement utilisées par au moins une automatisation, pour la
  // rangée de chips-filtres de la toolbar — jamais de valeur fictive codée
  // en dur, uniquement ce qui vient effectivement du label_registry.
  _getUsedLabels() {
    const seen = new Map();
    this._getAutomations().forEach((automation) => {
      automation.labels.forEach((label) => {
        if (!seen.has(label.id)) seen.set(label.id, label);
      });
    });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  _getFilteredAutomations() {
    let list = this._getAutomations();
    const needle = this._filterText.trim().toLowerCase();
    if (needle) {
      list = list.filter((automation) => automation.name.toLowerCase().includes(needle));
    }
    if (this._statusFilter !== "all") {
      list = list.filter((automation) => automation.state === this._statusFilter);
    }
    if (this._activeLabelFilters.size > 0) {
      // ET logique : une automatisation doit porter TOUTES les étiquettes
      // sélectionnées, pas juste une (comportement corrigé — c'était un OU
      // avant, qui élargissait au lieu d'affiner la sélection).
      list = list.filter((automation) =>
        [...this._activeLabelFilters].every((id) => automation.labels.some((label) => label.id === id))
      );
    }
    return list;
  }

  _groupAutomations(automations) {
    const buckets = new Map();
    const pushTo = (key, item) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    };

    if (this._groupBy === "state") {
      automations.forEach((a) => pushTo(a.state === "on" ? "Activées" : "Désactivées", a));
      return ["Activées", "Désactivées"]
        .filter((key) => buckets.has(key))
        .map((key) => ({ title: key, items: buckets.get(key) }));
    }

    if (this._groupBy === "category") {
      automations.forEach((a) => pushTo(a.category || "Sans catégorie", a));
      const keys = [...buckets.keys()].sort((a, b) =>
        a === "Sans catégorie" ? 1 : b === "Sans catégorie" ? -1 : a.localeCompare(b)
      );
      return keys.map((key) => ({ title: key, items: buckets.get(key) }));
    }

    if (this._groupBy === "area") {
      automations.forEach((a) => pushTo(a.area || "Sans pièce", a));
      const keys = [...buckets.keys()].sort((a, b) =>
        a === "Sans pièce" ? 1 : b === "Sans pièce" ? -1 : a.localeCompare(b)
      );
      return keys.map((key) => ({ title: key, items: buckets.get(key) }));
    }

    return [{ title: "", items: automations }];
  }

  // Tri appliqué après regroupement (à l'intérieur de chaque groupe, ou sur
  // la liste à plat si aucun regroupement actif) — indépendant de
  // _groupAutomations(), fonctionnement classique (ex. regrouper par pièce
  // + trier par nom au sein de chaque pièce). Ne mute pas le tableau reçu.
  _sortAutomations(automations) {
    if (this._sortBy === "none") return automations;
    const sorted = [...automations];
    if (this._sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this._sortBy === "area") {
      sorted.sort((a, b) => (a.area || "").localeCompare(b.area || ""));
    } else if (this._sortBy === "category") {
      sorted.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
    } else if (this._sortBy === "state") {
      sorted.sort((a, b) => (a.state === b.state ? 0 : a.state === "on" ? -1 : 1));
    }
    return sorted;
  }

  // Style unique pour les chips étiquette : plein pastel (inactif) ou plein
  // soutenu (actif, uniquement pour le filtre toolbar), avec un liseré de la
  // même couleur que le texte — généré dynamiquement via color-mix() à
  // partir de la couleur réelle de l'étiquette HA, qui n'est pas limitée à
  // 3 teintes fixes.
  _renderLabelChip(label, { clickable = false, active = false } = {}) {
    const color = safeLabelColor(label.color);
    const style = active
      ? `--chip-color:${color};background:var(--chip-color);color:#fff;border:1px solid color-mix(in srgb, var(--chip-color) 65%, black);`
      : `--chip-color:${color};background:color-mix(in srgb, var(--chip-color) 14%, white);color:color-mix(in srgb, var(--chip-color) 60%, black);border:1px solid color-mix(in srgb, var(--chip-color) 45%, white);`;
    const classes = ["chip", clickable ? "chip-clickable" : "", active ? "active" : ""]
      .filter(Boolean)
      .join(" ");
    const dataAttr = clickable ? ` data-label-id="${escapeHtml(label.id)}"` : "";
    // <ha-icon> : élément custom déjà défini globalement par le frontend HA
    // (le panel s'exécute dans la même page) — pas de dépendance CDN, et
    // résout n'importe quelle icône choisie pour l'étiquette (mdi:* ou tout
    // autre jeu d'icônes enregistré côté HA, ex. via une intégration custom)
    // sans avoir à embarquer un jeu d'icônes ici.
    const iconHtml = label.icon ? `<ha-icon icon="${escapeHtml(label.icon)}" class="chip-icon"></ha-icon>` : "";
    return `<span class="${classes}" style="${style}"${dataAttr}>${iconHtml}${escapeHtml(label.name)}</span>`;
  }

  _renderChips() {
    const usedLabels = this._getUsedLabels();
    if (usedLabels.length === 0) return "";
    const hasSelection = this._activeLabelFilters.size > 0;
    // Chip de réinitialisation toujours en première position — sélection
    // multiple des étiquettes, donc pas de clic "bascule" évident pour tout
    // désélectionner d'un coup sans elle.
    const resetChip = `<button class="chip chip-reset${hasSelection ? "" : " active"}" data-action="reset-labels" ${hasSelection ? "" : "disabled"}>Tout</button>`;
    const chips = usedLabels
      .map((label) =>
        this._renderLabelChip(label, { clickable: true, active: this._activeLabelFilters.has(label.id) })
      )
      .join("");
    return `<div class="chips-row">${resetChip}${chips}</div>`;
  }

  _groupLabel() {
    const option = GROUP_OPTIONS.find((item) => item.id === this._groupBy);
    if (!option || option.id === "none") return "Regrouper";
    return `Regroupé par ${option.label.toLowerCase()}`;
  }

  _renderGroupMenu() {
    if (!this._groupMenuOpen) return "";
    const options = GROUP_OPTIONS.map((option) => {
      const selected = option.id === this._groupBy;
      return `
        <div class="dropdown-option${selected ? " selected" : ""}" data-menu="group" data-value="${option.id}">
          <span>${option.label}</span>
          ${selected ? this._icon(ICON_CHECK, 14) : ""}
        </div>
      `;
    }).join("");
    return `
      <div class="dropdown-backdrop"></div>
      <div class="dropdown">${options}</div>
    `;
  }

  _sortLabel() {
    const option = SORT_OPTIONS.find((item) => item.id === this._sortBy);
    if (!option || option.id === "none") return "Trier";
    return `Trié par ${option.label.toLowerCase()}`;
  }

  _renderSortMenu() {
    if (!this._sortMenuOpen) return "";
    const options = SORT_OPTIONS.map((option) => {
      const selected = option.id === this._sortBy;
      return `
        <div class="dropdown-option${selected ? " selected" : ""}" data-menu="sort" data-value="${option.id}">
          <span>${option.label}</span>
          ${selected ? this._icon(ICON_CHECK, 14) : ""}
        </div>
      `;
    }).join("");
    return `
      <div class="dropdown-backdrop"></div>
      <div class="dropdown">${options}</div>
    `;
  }

  _renderStatusFilters() {
    const chips = STATUS_FILTERS.map((filter) => {
      const active = filter.id === this._statusFilter;
      return `<button class="status-chip${active ? " active" : ""}" data-value="${filter.id}">${filter.label}</button>`;
    }).join("");
    // Bouton désactivé (création pas encore codée) — même pattern que les
    // autres actions pas encore câblées (title + attribut disabled), voir
    // .edition-lock-btn/.settings-btn.disabled.
    return `
      <div class="status-filters">
        <button class="popup-btn popup-btn-primary new-automation-btn" title="Bientôt disponible" disabled>
          ${this._icon(ICON_PLUS, 14)}<span>Nouvelle automatisation</span>
        </button>
        <span class="status-filters-separator"></span>
        ${chips}
      </div>
    `;
  }

  _renderTableHeader() {
    return `
      <div class="automation-row automation-row-header">
        <div class="col-name">Nom</div>
        <div class="col-labels">Étiquettes</div>
        <div class="col-category">Catégorie</div>
        <div class="col-area">Pièce</div>
        <div class="col-state">État</div>
      </div>
    `;
  }

  _renderAutomationRow(automation) {
    const stateOn = automation.state === "on";
    const labelsHtml = automation.labels.map((label) => this._renderLabelChip(label)).join("");
    const categoryHtml = automation.category
      ? `<span class="meta-badge">${this._icon(ICON_FOLDER, 13)}<span>${escapeHtml(automation.category)}</span></span>`
      : `<span class="meta-empty">—</span>`;
    const areaHtml = automation.area
      ? `<span class="meta-badge">${this._icon(ICON_MAP_PIN, 13)}<span>${escapeHtml(automation.area)}</span></span>`
      : `<span class="meta-empty">—</span>`;
    return `
      <div class="automation-row${stateOn ? "" : " automation-row-off"}" data-entity-id="${escapeHtml(automation.entity_id)}">
        <div class="col-name" title="${escapeHtml(automation.name)}">
          <ha-icon class="row-icon" icon="${escapeHtml(automation.icon || "mdi:robot")}"></ha-icon>
          <div class="row-name-block">
            <span class="row-name-text">${escapeHtml(automation.name)}</span>
            <span class="row-entity-id">${escapeHtml(automation.entity_id)}</span>
          </div>
        </div>
        <div class="col-labels">${labelsHtml || '<span class="meta-empty">—</span>'}</div>
        <div class="col-category">${categoryHtml}</div>
        <div class="col-area">${areaHtml}</div>
        <div class="col-state">
          <span class="state-toggle ${stateOn ? "on" : "off"}${this._pendingToggles.has(automation.entity_id) ? " pending" : ""}" data-entity-id="${escapeHtml(automation.entity_id)}" title="${stateOn ? "Cliquer pour désactiver" : "Cliquer pour activer"}">
            <span class="state-toggle-knob"></span>
          </span>
          <div class="options-wrap">
            <button class="options-btn" data-entity-id="${escapeHtml(automation.entity_id)}" title="Options">
              ${this._icon(ICON_MORE_VERTICAL, 18)}
            </button>
            ${this._optionsMenuOpenFor === automation.entity_id ? this._renderOptionsMenu(automation) : ""}
          </div>
        </div>
      </div>
    `;
  }

  // Menu contextuel "Options" (kebab) d'une ligne d'automatisation — un seul
  // ouvert à la fois (_optionsMenuOpenFor), voir issue #55.
  _renderOptionsMenu(automation) {
    const stateOn = automation.state === "on";
    const downloadEnabled = this._storageMode === "folder";
    const items = [
      { action: "more-info", icon: ICON_INFO, label: "Plus d'informations" },
      { action: "detail", icon: ICON_FILE_TEXT, label: "Détail" },
      { action: "edition", icon: ICON_EDIT, label: "Édition" },
      { separator: true },
      {
        action: "download",
        icon: ICON_DOWNLOAD,
        label: "Télécharger",
        disabled: !downloadEnabled,
        title: downloadEnabled ? "" : "Disponible uniquement en mode dossier dédié",
      },
      {
        action: "duplicate",
        icon: ICON_COPY,
        label: "Dupliquer",
        disabled: true,
        title: "Pas encore disponible",
      },
      {
        action: "toggle-state",
        icon: stateOn ? ICON_TOGGLE_RIGHT : ICON_TOGGLE_LEFT,
        label: stateOn ? "Désactiver" : "Activer",
      },
      { action: "delete", icon: ICON_TRASH, label: "Supprimer", danger: true },
    ];
    const itemsHtml = items
      .map((item) => {
        if (item.separator) return `<div class="options-menu-separator"></div>`;
        const classes = ["options-menu-item", item.disabled ? "disabled" : "", item.danger ? "options-menu-item-danger" : ""]
          .filter(Boolean)
          .join(" ");
        return `
          <div class="${classes}" data-action="${item.action}" data-entity-id="${escapeHtml(automation.entity_id)}" title="${escapeHtml(item.title || "")}">
            ${this._icon(item.icon, 16)}
            <span>${item.label}</span>
          </div>
        `;
      })
      .join("");
    return `
      <div class="dropdown-backdrop"></div>
      <div class="options-menu">${itemsHtml}</div>
    `;
  }

  _findAutomation(entityId) {
    return this._getAutomations().find((a) => a.entity_id === entityId) || null;
  }

  // Sérialise un objet JS (config d'automatisation renvoyée par
  // GET config/automation/config/<id>) en lignes de texte YAML, pour
  // affichage dans la page Édition (mode Code, lecture seule — #87).
  // Volontairement générique, sans connaître les noms de champs HA
  // (trigger/triggers, condition/conditions... le nommage a changé selon
  // les versions HA, voir ARCHITECTURE.md §8) : sérialise fidèlement
  // n'importe quelle clé présente. Pas destiné à un round-trip d'édition
  // (hors périmètre de ce lot), uniquement à l'affichage.
  _stringifyYamlScalar(value) {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    if (typeof value !== "string") return JSON.stringify(value);
    if (value === "") return '""';
    const needsQuoting =
      /^[\s"'>|*&!%#@`[\]{},:-]/.test(value) ||
      /:\s|\s$/.test(value) ||
      /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
      /^-?\d+(\.\d+)?$/.test(value);
    return needsQuoting ? JSON.stringify(value) : value;
  }

  _stringifyYaml(value, indent = 0) {
    const lines = [];
    const pad = (level) => "  ".repeat(level);
    const walkMapping = (obj, level) => {
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        if (v !== null && typeof v === "object") {
          const empty = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0;
          if (empty) {
            lines.push(`${pad(level)}${key}: ${Array.isArray(v) ? "[]" : "{}"}`);
          } else {
            lines.push(`${pad(level)}${key}:`);
            walkAny(v, level + 1);
          }
        } else {
          lines.push(`${pad(level)}${key}: ${this._stringifyYamlScalar(v)}`);
        }
      }
    };
    const walkSequence = (arr, level) => {
      for (const item of arr) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const keys = Object.keys(item);
          if (keys.length === 0) {
            lines.push(`${pad(level)}- {}`);
            continue;
          }
          const [firstKey, ...restKeys] = keys;
          const firstValue = item[firstKey];
          const firstIsObject = firstValue !== null && typeof firstValue === "object";
          lines.push(`${pad(level)}- ${firstKey}:${firstIsObject ? "" : ` ${this._stringifyYamlScalar(firstValue)}`}`);
          if (firstIsObject) walkAny(firstValue, level + 2);
          if (restKeys.length) walkMapping(Object.fromEntries(restKeys.map((k) => [k, item[k]])), level + 1);
        } else if (Array.isArray(item)) {
          lines.push(`${pad(level)}-`);
          walkSequence(item, level + 1);
        } else {
          lines.push(`${pad(level)}- ${this._stringifyYamlScalar(item)}`);
        }
      }
    };
    const walkAny = (val, level) => {
      if (Array.isArray(val)) walkSequence(val, level);
      else if (val !== null && typeof val === "object") walkMapping(val, level);
      else lines.push(`${pad(level)}${this._stringifyYamlScalar(val)}`);
    };
    walkAny(value, indent);
    return lines;
  }

  // Sidebar "Aller à" de la vue Code (issue #112) : localise la ligne
  // top-level trigger(s)/condition(s)/action(s) dans state.lines (généré par
  // _stringifyYaml ci-dessus — une clé top-level apparaît sans indentation,
  // ex. "trigger:") et la fin de son bloc (première ligne suivante non
  // indentée), pour surligner tout le bloc au clic, pas juste l'en-tête.
  // Réutilise EDITION_LIST_KEYS pour couvrir singulier ET pluriel. Retourne
  // null si la section est absente du YAML (alimente l'état désactivé du
  // bouton correspondant, voir _renderEditionCodeSidebar).
  _findEditionCodeLineRange(category) {
    const state = this._editionYaml;
    if (!state || !state.lines) return null;
    const [singular, plural] = EDITION_LIST_KEYS[category];
    const start = state.lines.findIndex(
      (line) => line === `${singular}:` || line === `${plural}:`
    );
    if (start === -1) return null;
    let end = state.lines.length - 1;
    for (let i = start + 1; i < state.lines.length; i++) {
      if (/^\S/.test(state.lines[i])) {
        end = i - 1;
        break;
      }
    }
    return { start, end };
  }

  // Ensemble des index de ligne correspondant à la recherche en cours dans
  // la sidebar de la vue Code (issue #112) — comparaison insensible à la
  // casse, sous-chaîne simple (pas de regex). Retourne null hors recherche
  // (champ vide), pour distinguer "aucune recherche" de "recherche sans
  // résultat" dans les deux consommateurs (_renderEditionCodeLines,
  // _scrollEditionCodeToFirstMatch).
  _editionCodeSearchMatches() {
    const state = this._editionYaml;
    const query = this._editionCodeSearchQuery.trim().toLowerCase();
    if (!query || !state.lines) return null;
    const indices = new Set();
    state.lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query)) indices.add(index);
    });
    return indices;
  }

  // Scroll bas niveau vers une ligne précise (issue #112) — ancré sur
  // .edition-scroll-area (jamais .edition-code seul) : c'est cette zone qui
  // scroll, gouttière et code doivent défiler ensemble (cf. commentaire de
  // _renderEditionCode). Le surlignage lui-même n'est plus géré ici : il est
  // dérivé de l'état (_editionCodeActiveCategory/_editionCodeSearchQuery) à
  // chaque appel de _renderEditionCodeLines()/_renderEditionCodeGutter(),
  // jamais posé/retiré via classList en dehors du render.
  _scrollEditionCodeToLine(index) {
    const root = this.shadowRoot;
    if (index == null || index < 0 || !root) return;
    const scrollArea = root.querySelector(".edition-scroll-area");
    const allLines = root.querySelectorAll(".edition-code .edition-line-text");
    const target = allLines[index];
    if (!scrollArea || !target) return;
    const areaRect = scrollArea.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    scrollArea.scrollTo({
      top: scrollArea.scrollTop + (targetRect.top - areaRect.top) - 20,
      behavior: "smooth",
    });
  }

  // Scroll vers le début du bloc actif de la sidebar "Aller à" — appelé
  // juste après un _render() (donc une fois le nouveau DOM en place) suite
  // au clic sur un bouton de catégorie.
  _scrollEditionCodeToActiveCategory() {
    const category = this._editionCodeActiveCategory;
    const range = category ? this._findEditionCodeLineRange(category) : null;
    if (range) this._scrollEditionCodeToLine(range.start);
  }

  // Scroll vers la première ligne correspondant à la recherche en cours —
  // appelé à chaque frappe dans le champ recherche de la sidebar Code, sans
  // passer par _render() (voir listener "input" de _attachListeners, même
  // contrainte de focus que la recherche de la Palette en vue Liste).
  _scrollEditionCodeToFirstMatch() {
    const matches = this._editionCodeSearchMatches();
    if (!matches || !matches.size) return;
    this._scrollEditionCodeToLine(Math.min(...matches));
  }

  // Positionne le menu Options (.options-menu, position: fixed) par rapport
  // au bouton kebab cliqué — nécessaire depuis le passage à position: fixed
  // (voir _renderOptionsMenu) qui échappe aux overflow:hidden/auto ancêtres
  // mais n'est plus positionné par le flux CSS normal. Bascule vers le haut
  // si l'espace sous le bouton est insuffisant pour la hauteur du menu.
  _positionOptionsMenu(button, menuEl) {
    const buttonRect = button.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const openUpward = spaceBelow < menuRect.height + 8 && buttonRect.top > menuRect.height + 8;

    menuEl.style.left = `${Math.max(8, buttonRect.right - menuRect.width)}px`;
    menuEl.style.bottom = "auto";
    // Borné par max-height (voir CSS .options-menu) sur petit viewport, mais
    // le point d'ancrage lui-même peut encore pousser le menu hors écran
    // quand ni le haut ni le bas du bouton n'ont assez de place (issue #69)
    // — clamp final dans les deux sens plutôt que de faire confiance au seul
    // choix de direction ci-dessus.
    const top = openUpward ? buttonRect.top - menuRect.height - 4 : buttonRect.bottom + 4;
    menuEl.style.top = `${Math.min(Math.max(top, 8), viewportHeight - menuRect.height - 8)}px`;
  }

  // Popup de confirmation de suppression (menu Options > Supprimer, design
  // pen `DCk3N`) — un seul à la fois (_deleteConfirmFor), fermé par le
  // backdrop, la croix ou Annuler tant que _deleteInProgress est faux.
  _renderDeleteConfirmPopup() {
    const automation = this._findAutomation(this._deleteConfirmFor);
    if (!automation) return "";
    return `
      <div class="popup-overlay" data-popup="delete">
        <div class="popup-card popup-delete">
          <div class="popup-header">
            <div class="popup-header-title danger">
              ${this._icon(ICON_TRASH, 16)}
              <span>Supprimer l'automatisation ?</span>
            </div>
            <button class="popup-close" data-action="cancel-delete" title="Fermer">${this._icon(ICON_X, 14)}</button>
          </div>
          <div class="popup-body">
            <p>L'automatisation « ${escapeHtml(automation.name)} » sera définitivement supprimée.</p>
            <p class="popup-text-secondary">Cette action est irréversible : la configuration YAML correspondante sera retirée de votre installation Home Assistant.</p>
          </div>
          <div class="popup-footer">
            <button class="popup-btn popup-btn-secondary" data-action="cancel-delete" ${this._deleteInProgress ? "disabled" : ""}>Annuler</button>
            <button class="popup-btn popup-btn-danger" data-action="confirm-delete" ${this._deleteInProgress ? "disabled" : ""}>
              ${this._icon(ICON_TRASH, 14)}<span>${this._deleteInProgress ? "Suppression…" : "Supprimer"}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Popup "Détail" (menu Options, design pen `i3oGr`) — édite les
  // métadonnées registre HA d'une automatisation (nom, icône, pièce,
  // catégorie, étiquettes) + son activation. Pièce et Catégorie en
  // sélection unique (contrairement à la maquette pen, à chips multiples) :
  // la réalité HA ne stocke qu'une seule pièce et une seule catégorie par
  // entité, voir entity_registry (`area_id`, `categories.automation`).
  _renderAutomationDetailPopup() {
    const draft = this._detailDraft;
    if (!draft) return "";
    const areaOptions = [`<option value="">Aucune</option>`]
      .concat(
        [...this._areaRegistry.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (area) =>
              `<option value="${escapeHtml(area.area_id)}" ${draft.areaId === area.area_id ? "selected" : ""}>${escapeHtml(area.name)}</option>`
          )
      )
      .join("");
    const categoryOptions = [`<option value="">Aucune</option>`]
      .concat(
        [...this._categoryRegistry.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (category) =>
              `<option value="${escapeHtml(category.category_id)}" ${draft.categoryId === category.category_id ? "selected" : ""}>${escapeHtml(category.name)}</option>`
          )
      )
      .join("");
    const selectedLabels = draft.labelIds.map((id) => this._labelRegistry.get(id)).filter(Boolean);
    const labelChipsHtml = selectedLabels
      .map((label) => {
        const color = safeLabelColor(label.color);
        const style = `--chip-color:${color};background:color-mix(in srgb, var(--chip-color) 14%, white);color:color-mix(in srgb, var(--chip-color) 60%, black);border:1px solid color-mix(in srgb, var(--chip-color) 45%, white);`;
        return `
          <span class="detail-label-chip" style="${style}">
            <span>${escapeHtml(label.name)}</span>
            <button type="button" data-action="remove-label" data-label-id="${escapeHtml(label.label_id)}" title="Retirer">${this._icon(ICON_X, 10)}</button>
          </span>
        `;
      })
      .join("");
    const remainingLabels = [...this._labelRegistry.values()]
      .filter((label) => !draft.labelIds.includes(label.label_id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const addLabelOptions = [`<option value="">+ Étiquette</option>`]
      .concat(remainingLabels.map((label) => `<option value="${escapeHtml(label.label_id)}">${escapeHtml(label.name)}</option>`))
      .join("");
    return `
      <div class="popup-overlay" data-popup="detail">
        <div class="popup-card popup-detail">
          <div class="popup-header">
            <div class="popup-header-title">
              <span>Détails de l'automatisation</span>
            </div>
            <button class="popup-close" data-action="cancel-detail" title="Fermer">${this._icon(ICON_X, 14)}</button>
          </div>
          <div class="popup-body">
            <div class="detail-field">
              <div class="detail-label-row">
                <span class="detail-label">Nom</span>
                <span class="detail-id">ID #${escapeHtml(draft.id || "")}</span>
              </div>
              <div class="detail-input detail-name-row">
                <input type="text" data-field="name" value="${escapeHtml(draft.name)}" style="border:none;background:transparent;flex:1;font:inherit;color:inherit;outline:none;padding:0;" />
                ${this._icon(ICON_EDIT, 14)}
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-label">Entity ID</span>
              <div class="detail-entity-input">
                <input type="text" data-field="entityId" value="${escapeHtml(draft.entityId)}" style="border:none;background:transparent;flex:1;color:inherit;outline:none;padding:0;" />
                ${this._icon(ICON_EDIT, 14)}
              </div>
              <button type="button" class="detail-regenerate-btn" data-action="regenerate-entity-id">
                ${this._icon(ICON_REFRESH_CW, 12)}<span>Régénérer depuis le nom</span>
              </button>
              <div class="detail-entity-warning">
                ${this._icon(ICON_ALERT_TRIANGLE, 12)}
                <span>Renommer l'entity ID peut casser des automatisations, scripts ou tableaux de bord qui le référencent.</span>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-label">Icône</span>
              <div class="detail-icon-row">
                <div class="detail-icon-preview"><ha-icon icon="${escapeHtml(draft.icon || "mdi:robot")}"></ha-icon></div>
                <input type="text" class="detail-input" data-field="icon" value="${escapeHtml(draft.icon)}" placeholder="mdi:robot" style="flex:1;" />
              </div>
            </div>
            <div class="detail-separator"></div>
            <div class="detail-field">
              <span class="detail-label">Pièce</span>
              <select class="detail-select" data-field="areaId">${areaOptions}</select>
            </div>
            <div class="detail-field">
              <span class="detail-label">Catégorie</span>
              <select class="detail-select" data-field="categoryId">${categoryOptions}</select>
            </div>
            <div class="detail-field">
              <span class="detail-label">Étiquette(s)</span>
              <div class="detail-labels-zone">
                ${labelChipsHtml}
                <select class="detail-label-add" data-field="add-label">${addLabelOptions}</select>
              </div>
            </div>
            <div class="detail-separator"></div>
            <div class="detail-toggle-row">
              <div class="detail-toggle-text">
                <span class="primary">Automatisation activée</span>
                <span class="secondary">${draft.activated ? "Elle se déclenchera normalement" : "Désactivée, elle ne se déclenchera plus"}</span>
              </div>
              <span class="state-toggle ${draft.activated ? "on" : "off"}" data-action="toggle-activation">
                <span class="state-toggle-knob"></span>
              </span>
            </div>
          </div>
          <div class="popup-footer">
            <button class="popup-btn popup-btn-secondary" data-action="cancel-detail" ${this._detailSaving ? "disabled" : ""}>Annuler</button>
            <button class="popup-btn popup-btn-primary" data-action="save-detail" ${this._detailSaving ? "disabled" : ""}>
              ${this._icon(ICON_CHECK, 14)}<span>${this._detailSaving ? "Enregistrement…" : "Enregistrer"}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _openDeleteConfirm(entityId) {
    this._deleteConfirmFor = entityId;
    this._render();
  }

  _closeDeleteConfirm() {
    if (this._deleteInProgress) return;
    this._deleteConfirmFor = null;
    this._render();
  }

  // Ouvre la page Édition (vues Liste/Code, lecture seule — #5/#87), depuis
  // le menu Options ("Édition") ou un clic sur la ligne (hors toggle État/
  // menu Options, voir le délégué de clic de .list-container). Liste est la
  // vue par défaut (#5) ; Code reste disponible en onglet secondaire.
  _openEdition(automation) {
    if (!automation) return;
    this._optionsMenuOpenFor = null;
    this._view = "edition";
    this._editionSubView = "liste";
    this._editionAutomation = automation;
    this._editionHelpOpen = false;
    this._selectedBlock = null;
    this._editionOriginalConfig = null;
    this._editionBlockOriginMap = { trigger: [], condition: [], action: [] };
    this._editionHistory = { past: [], future: [] };
    this._editionBlockMenuOpenFor = null;
    this._editionPaletteQuery = "";
    this._editionPaletteActiveCategory = "trigger";
    this._editionCodeActiveCategory = null;
    this._editionCodeSearchQuery = "";
    this._render();
    this._loadEditionYaml();
  }

  async _loadEditionYaml() {
    if (!this._hass || !this._editionAutomation) return;
    // Point de reset unique de l'historique Undo/Redo (issue #90, lot 1) et
    // de la sidebar "Aller à"/recherche de la vue Code (issue #112) : couvre
    // l'ouverture d'une automatisation (_openEdition) ET le discard total
    // (_editionDiscardChanges), qui passent tous deux par ici. Posé avant la
    // sortie anticipée mode dossier pour ne jamais laisser un état orphelin
    // d'une automatisation précédente.
    this._editionHistory = { past: [], future: [] };
    this._editionCodeActiveCategory = null;
    this._editionCodeSearchQuery = "";
    // Mode dossier dédié : l'API native HA est câblée en dur sur
    // automations.yaml, inutilisable ici (voir ARCHITECTURE.md §8) — route
    // backend dédiée pas encore construite (#92). Erreur explicite plutôt
    // qu'un GET voué à échouer silencieusement.
    if (this._storageMode === "folder") {
      this._editionYaml = {
        loading: false,
        lines: null,
        config: null,
        error: "Mode dossier dédié : la page Édition n'est pas encore disponible pour ce mode.",
      };
      this._render();
      return;
    }
    this._editionYaml = { loading: true, lines: null, config: null, error: null };
    this._render();
    try {
      const config = await this._hass.callApi(
        "GET",
        `config/automation/config/${this._editionAutomation.id}`
      );
      // config brut conservé (pas seulement stringifié) : la vue Liste lit
      // directement trigger(s)/condition(s)/action(s) dessus, cf. _renderEditionListe().
      this._editionYaml = {
        loading: false,
        lines: this._stringifyYaml(config),
        config,
        error: null,
      };
      // Photo de la config d'origine (clonage profond, jamais mutée
      // ensuite) + correspondance identité index→index par catégorie, pour
      // dériver "modifié" par comparaison de contenu plutôt qu'un drapeau
      // manuel (voir _editionCategoryChanged()/_editionIsBlockModified()).
      this._editionOriginalConfig = JSON.parse(JSON.stringify(config));
      this._editionBlockOriginMap = {};
      for (const category of Object.keys(EDITION_LIST_KEYS)) {
        const [singular, plural] = EDITION_LIST_KEYS[category];
        this._editionBlockOriginMap[category] = pickList(config, singular, plural).map((_, i) => i);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec du chargement du YAML de l'automatisation", err);
      this._editionYaml = {
        loading: false,
        lines: null,
        config: null,
        error: "Impossible de charger le YAML de cette automatisation.",
      };
    } finally {
      this._render();
    }
  }

  // Vrai si le bloc à cet index de cette catégorie est le bloc actuellement
  // sélectionné dans le Panneau Paramètres (issue #101).
  _isBlockSelected(category, index) {
    return !!this._selectedBlock && this._selectedBlock.category === category && this._selectedBlock.index === index;
  }

  // Résout l'objet bloc actuellement sélectionné à partir de
  // this._editionYaml.config — jamais mis en cache séparément, toujours lu
  // depuis la source unique pour rester cohérent après mutation.
  _editionGetSelectedBlock() {
    if (!this._selectedBlock) return null;
    const state = this._editionYaml;
    if (!state || !state.config) return null;
    const [singular, plural] = EDITION_LIST_KEYS[this._selectedBlock.category];
    return pickList(state.config, singular, plural)[this._selectedBlock.index] ?? null;
  }

  _editionGetFieldValue(block, key) {
    const segments = key.split(".");
    let cur = block;
    for (const segment of segments) {
      if (cur == null) return undefined;
      cur = cur[segment];
    }
    return cur;
  }

  _editionSetFieldValue(block, key, value) {
    const segments = key.split(".");
    let cur = block;
    for (let i = 0; i < segments.length - 1; i++) {
      if (typeof cur[segments[i]] !== "object" || cur[segments[i]] === null) cur[segments[i]] = {};
      cur = cur[segments[i]];
    }
    const lastKey = segments[segments.length - 1];
    if (value === "" || value === undefined) delete cur[lastKey];
    else cur[lastKey] = value;
  }

  // Repli générique (bloc hors schéma, cf. getBlockFields "raw") : tente de
  // reconnaître un nombre/booléen pour ne pas dégrader silencieusement le
  // type d'une valeur existante non modifiée en simple chaîne de caractères.
  _editionParseRawValue(text) {
    if (text === "") return "";
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if (text === "true") return true;
    if (text === "false") return false;
    return text;
  }

  // Point d'écriture unique de toute mutation d'une liste trigger(s)/
  // condition(s)/action(s) (issue #101) : lit une copie profonde via
  // pickList (jamais l'objet config d'origine en place), applique
  // `mutator(list)`, puis réécrit systématiquement sur la clé plurielle —
  // normalisation assumée (voir plan), supprime la forme singulière si
  // présente. Ré-génère aussi this._editionYaml.lines à chaque appel pour
  // que l'onglet Code ne reste jamais périmé (bascule Liste → Code). Aucun
  // appel réseau : écriture 100% en mémoire (dépend de #88/#89/#92 pour la
  // persistance réelle).
  _editionMutateList(category, mutator) {
    const state = this._editionYaml;
    if (!state || !state.config) return;
    const [singular, plural] = EDITION_LIST_KEYS[category];
    const beforeList = pickList(state.config, singular, plural);
    const list = JSON.parse(JSON.stringify(beforeList));
    mutator(list);
    // Historique Undo/Redo (issue #90, lot 1) : snapshot pris ici, avant
    // réécriture de state.config plus bas — donc de l'état "avant
    // l'opération complète", correct pour un undo. Garde anti-no-op :
    // comparaison de la sérialisation JSON déjà calculée, n'empile que si
    // la mutation a réellement changé quelque chose (évite un undo fantôme
    // pour un mutator appelé sans effet, ex. bloc introuvable). Muet
    // pendant une restauration (_editionRestoreSnapshot) pour ne jamais
    // s'auto-empiler si elle repasse par ce point.
    if (!this._editionHistoryMuted && JSON.stringify(beforeList) !== JSON.stringify(list)) {
      this._editionPushHistory();
    }
    const config = { ...state.config, [plural]: list };
    delete config[singular];
    state.config = config;
    state.lines = this._stringifyYaml(config);
  }

  // Snapshot complet de l'état annulable de la vue Liste (issue #90, lot 1) :
  // config + _editionBlockOriginMap (indexé par position, doit rester
  // synchrone avec config sous peine de rouvrir le piège position-only déjà
  // corrigé sur _editionDirty) + selectedBlock (contexte de sélection perçu
  // par l'utilisateur). state.lines est dérivé, jamais snapshoté.
  _editionSnapshot() {
    return {
      config: JSON.parse(JSON.stringify(this._editionYaml.config)),
      originMap: JSON.parse(JSON.stringify(this._editionBlockOriginMap)),
      selectedBlock: this._selectedBlock ? { ...this._selectedBlock } : null,
    };
  }

  _editionPushHistory() {
    this._editionHistory.past.push(this._editionSnapshot());
    if (this._editionHistory.past.length > EDITION_HISTORY_LIMIT) {
      this._editionHistory.past.shift();
    }
    // Toute nouvelle mutation invalide la branche "refaire" en cours.
    this._editionHistory.future = [];
  }

  // Réécrit directement _editionBlockOriginMap/_selectedBlock (jamais via
  // les fonctions de réalignement _editionOnBlock*, qui supposent une
  // mutation incrémentale — ici on restaure un état déjà cohérent tel quel).
  _editionRestoreSnapshot(snapshot) {
    const state = this._editionYaml;
    state.config = JSON.parse(JSON.stringify(snapshot.config));
    state.lines = this._stringifyYaml(state.config);
    this._editionBlockOriginMap = JSON.parse(JSON.stringify(snapshot.originMap));
    this._selectedBlock = snapshot.selectedBlock ? { ...snapshot.selectedBlock } : null;
    // Un menu kebab resté ouvert sur un index qui vient de changer de sens
    // serait un piège (issue #105) — toujours refermé après restauration.
    this._editionBlockMenuOpenFor = null;
  }

  _editionUndo() {
    if (!this._editionHistory.past.length) return;
    this._editionHistoryMuted = true;
    try {
      const current = this._editionSnapshot();
      const previous = this._editionHistory.past.pop();
      this._editionHistory.future.push(current);
      this._editionRestoreSnapshot(previous);
    } finally {
      this._editionHistoryMuted = false;
    }
    this._render();
  }

  _editionRedo() {
    if (!this._editionHistory.future.length) return;
    this._editionHistoryMuted = true;
    try {
      const current = this._editionSnapshot();
      const next = this._editionHistory.future.pop();
      this._editionHistory.past.push(current);
      this._editionRestoreSnapshot(next);
    } finally {
      this._editionHistoryMuted = false;
    }
    this._render();
  }

  _editionSetBlockField(key, fieldType, rawValue) {
    if (!this._selectedBlock) return;
    const { category, index } = this._selectedBlock;
    let value = rawValue;
    if (fieldType === "number") {
      value = rawValue === "" ? undefined : Number(rawValue);
      if (Number.isNaN(value)) value = undefined;
    } else if (fieldType === "raw") {
      value = this._editionParseRawValue(rawValue);
    } else if (fieldType === "list") {
      // Champ "weekday" (issue #102, ajustement post-review) : rawValue est
      // déjà un tableau (pas de coercion texte→valeur), vide = pas de
      // restriction HA → clé supprimée plutôt qu'un `[]` explicite.
      value = Array.isArray(rawValue) && rawValue.length ? rawValue : undefined;
    } else if (fieldType !== "boolean") {
      value = rawValue === "" ? undefined : rawValue;
    }
    this._editionMutateList(category, (list) => {
      const block = list[index];
      if (!block) return;
      this._editionSetFieldValue(block, key, value);
    });
    this._render();
  }

  _editionAddRawField(key, rawValue) {
    const trimmedKey = key.trim();
    if (!trimmedKey || !this._selectedBlock) return;
    this._editionSetBlockField(trimmedKey, "raw", rawValue);
  }

  // Champ "weekday" (issue #102, ajustement post-review) : bascule un jour
  // dans/hors du tableau existant plutôt que de remplacer toute la valeur
  // (chips cliquables individuellement, voir _renderEditionFieldRow()).
  _editionToggleWeekdayDay(key, day) {
    const block = this._editionGetSelectedBlock();
    if (!block) return;
    const current = this._editionGetFieldValue(block, key);
    const days = Array.isArray(current) ? [...current] : [];
    const dayIndex = days.indexOf(day);
    if (dayIndex === -1) days.push(day);
    else days.splice(dayIndex, 1);
    this._editionSetBlockField(key, "list", days);
  }

  // Réalignement après une mutation STRUCTURELLE (duplication/suppression,
  // issue #105) — contrairement à une simple édition de champ, insérer ou
  // retirer un bloc décale les index de tous les blocs suivants de la même
  // catégorie. _selectedBlock ET _editionBlockOriginMap (qui fait
  // correspondre chaque index courant à son index d'origine, voir
  // _editionIsBlockModified) sont tous deux indexés par position : sans ce
  // réalignement ils pointeraient sur le mauvais bloc juste après l'opération.
  _editionOnBlockInserted(category, atIndex) {
    if (this._selectedBlock && this._selectedBlock.category === category && this._selectedBlock.index >= atIndex) {
      this._selectedBlock = { category, index: this._selectedBlock.index + 1 };
    }
    // null = pas de contrepartie d'origine (bloc ajouté/dupliqué) — toujours
    // considéré modifié, voir _editionIsBlockModified().
    this._editionBlockOriginMap[category].splice(atIndex, 0, null);
  }

  _editionOnBlockRemoved(category, atIndex) {
    if (this._selectedBlock && this._selectedBlock.category === category) {
      if (this._selectedBlock.index === atIndex) this._selectedBlock = null;
      else if (this._selectedBlock.index > atIndex) this._selectedBlock = { category, index: this._selectedBlock.index - 1 };
    }
    this._editionBlockOriginMap[category].splice(atIndex, 1);
  }

  // Réalignement après un glisser-déposer (issue #110) — volontairement pas
  // exprimé comme un retrait+insertion enchaînés (_editionOnBlockRemoved puis
  // _editionOnBlockInserted) : un déplacement du bloc actuellement sélectionné
  // doit RESTER sélectionné à sa nouvelle position, alors qu'un retrait pur
  // désélectionne toujours (comportement voulu pour la suppression, pas ici).
  _editionOnBlockMoved(category, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const map = this._editionBlockOriginMap[category];
    const [movedOrigin] = map.splice(fromIndex, 1);
    map.splice(toIndex, 0, movedOrigin);
    if (this._selectedBlock && this._selectedBlock.category === category) {
      const i = this._selectedBlock.index;
      let next = i;
      if (i === fromIndex) next = toIndex;
      else if (fromIndex < i && i <= toIndex) next = i - 1;
      else if (toIndex <= i && i < fromIndex) next = i + 1;
      this._selectedBlock = { category, index: next };
    }
  }

  _editionMoveBlock(category, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    this._editionMutateList(category, (list) => {
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
    });
    this._editionOnBlockMoved(category, fromIndex, toIndex);
    this._render();
  }

  // Menu kebab par bloc (issue #105) : Dupliquer (copie insérée juste après
  // l'original, toujours activée par défaut même si l'original ne l'était
  // pas, alias "<nom> (dupliqué)"), Activer/Désactiver (clé HA `enabled`,
  // réellement supportée sur trigger/condition/action — absente = activé par
  // défaut) et Supprimer (retrait direct, sans popup — décision explicite,
  // voir #105 : rien n'est perdu réellement tant que rien n'est enregistré,
  // Annuler du header permet déjà de tout annuler d'un coup).
  _editionDuplicateBlock(category, index) {
    const hass = this._hass;
    let insertedIndex = null;
    this._editionMutateList(category, (list) => {
      const original = list[index];
      if (!original) return;
      const clone = JSON.parse(JSON.stringify(original));
      const described =
        category === "trigger" ? describeTrigger(original, hass) : category === "condition" ? describeCondition(original, hass) : describeAction(original, hass);
      const baseName = original.alias || described.title;
      clone.alias = `${baseName} (dupliqué)`;
      delete clone.enabled;
      insertedIndex = index + 1;
      list.splice(insertedIndex, 0, clone);
    });
    if (insertedIndex === null) return;
    this._editionOnBlockInserted(category, insertedIndex);
    this._render();
  }

  _editionToggleBlockEnabled(category, index) {
    this._editionMutateList(category, (list) => {
      const block = list[index];
      if (!block) return;
      const enabled = block.enabled !== false;
      if (enabled) block.enabled = false;
      else delete block.enabled;
    });
    this._render();
  }

  _editionDeleteBlock(category, index) {
    this._editionMutateList(category, (list) => {
      list.splice(index, 1);
    });
    this._editionOnBlockRemoved(category, index);
    this._render();
  }

  // Insertion depuis la Sidebar Palette (issue #102) : toujours en fin du
  // groupe top-level (trigger:/condition:/action:), jamais après le bloc
  // sélectionné ni dans une branche sequence: d'un choose/if existant
  // (hors périmètre — blocs imbriqués non représentés dans la Zone
  // Centrale). buildDefaultBlock() (catalogue, #100) pose déjà les champs
  // requis du schéma. Sélectionne le bloc créé pour ouvrir directement le
  // Panneau Paramètres — _editionOnBlockInserted() réaligne les index mais
  // ne sélectionne rien de lui-même, d'où l'affectation explicite après.
  _editionInsertBlock(category, typeKey) {
    if (!typeKey) return;
    let insertedIndex = null;
    this._editionMutateList(category, (list) => {
      insertedIndex = list.length;
      list.push(buildDefaultBlock(category, typeKey));
    });
    if (insertedIndex === null) return;
    this._editionOnBlockInserted(category, insertedIndex);
    this._selectedBlock = { category, index: insertedIndex };
    this._render();
  }

  _handleEditionBlockMenuAction(action, category, index) {
    this._editionBlockMenuOpenFor = null;
    if (action === "duplicate") this._editionDuplicateBlock(category, index);
    else if (action === "toggle-enabled") this._editionToggleBlockEnabled(category, index);
    else if (action === "delete") this._editionDeleteBlock(category, index);
    else this._render();
  }

  _editionEntityOptions() {
    const hass = this._hass;
    if (!hass || !hass.states) return "";
    return Object.keys(hass.states)
      .sort()
      .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(hass.states[id]?.attributes?.friendly_name || "")}</option>`)
      .join("");
  }

  // Bouton "Annuler" du header, vue Liste (issue #101, suite à retour
  // utilisateur) : abandonne TOUTES les modifications en mémoire d'un coup
  // en rechargeant l'automatisation depuis HA — aucune écriture réseau,
  // reste dans le périmètre mémoire déjà validé. Discard total distinct de
  // Undo/Redo (historique pas à pas, issue #90) : _loadEditionYaml() vide
  // aussi la pile undo/redo, un ancien état intermédiaire abandonné ne doit
  // pas redevenir accessible après un "Annuler".
  _editionDiscardChanges() {
    if (!this._editionDirty) return;
    this._selectedBlock = null;
    this._editionBlockMenuOpenFor = null;
    this._loadEditionYaml();
  }

  _openDetailPopup(automation) {
    // Rafraîchit les registres HA à chaque ouverture (issue #59) : une
    // étiquette/pièce/catégorie créée après le chargement initial du panel
    // n'apparaîtrait sinon dans les sélecteurs qu'après un rechargement
    // complet de la page. _loadRegistries() se protège déjà contre les
    // appels concurrents (_registriesLoading) et se re-render seule à la
    // fin — volontairement pas relancée depuis set hass() (zone fragile,
    // voir régression scroll v0.6.8).
    this._loadRegistries();
    this._detailPopupFor = automation.entity_id;
    this._detailDraft = {
      id: automation.id,
      name: automation.name,
      icon: automation.icon || "",
      areaId: automation.area_id || "",
      categoryId: automation.category_id || "",
      labelIds: [...automation.label_ids],
      activated: automation.state === "on",
      // Snapshot pris à l'ouverture (issue #68) : name/icon ne sont envoyés
      // au registre que s'ils diffèrent réellement de ces valeurs d'origine
      // — sinon un simple "Enregistrer" sans y toucher figerait l'alias YAML
      // affiché comme override de registre.
      originalName: automation.name,
      originalIcon: automation.icon || "",
      // Même logique pour l'entity_id (issue #81) : new_entity_id n'est
      // envoyé au WS que si ce champ diffère réellement de l'original.
      entityId: automation.entity_id,
      originalEntityId: automation.entity_id,
    };
    this._render();
  }

  _closeDetailPopup() {
    if (this._detailSaving) return;
    this._detailPopupFor = null;
    this._detailDraft = null;
    this._render();
  }

  // Suppression réelle (issue #55) : mode fichier standard via l'API REST HA
  // native (jamais d'accès disque direct, voir CLAUDE.md), mode dossier
  // dédié via notre propre route (AutomationPlusAutomationItemView), qui
  // déclenche déjà `automation.reload` côté serveur.
  async _deleteAutomation(entityId) {
    const automation = this._findAutomation(entityId);
    if (!automation || !automation.id || this._deleteInProgress) return;
    this._deleteInProgress = true;
    this._render();
    try {
      if (this._storageMode === "folder") {
        await this._hass.callApi("DELETE", `${API_PATHS.automations}/${automation.id}`);
      } else {
        // DELETE /api/config/automation/config/<id> déclenche déjà un
        // rechargement complet côté HA (issue #74) — un callService reload
        // explicite ici double le coût sans bénéfice constaté.
        await this._hass.callApi("DELETE", `config/automation/config/${automation.id}`);
      }
      this._deleteConfirmFor = null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec de la suppression d'automatisation", entityId, err);
      this._showErrorToast(`Impossible de supprimer « ${automation.name} ».`);
    } finally {
      this._deleteInProgress = false;
      this._render();
    }
  }

  // Slug pour le bouton "Régénérer depuis le nom" (issue #81) : jamais
  // appliqué automatiquement, seulement un point de départ que l'utilisateur
  // peut encore éditer avant d'enregistrer.
  _slugifyName(name) {
    const diacritics = new RegExp(
      "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
      "g"
    );
    return (name || "")
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  // Enregistrement des métadonnées registre (nom/icône/pièce/catégorie/
  // étiquettes) via l'API WebSocket standard HA — jamais d'écriture directe
  // de fichier. L'activation (marche/arrêt) n'est pas un champ du registre :
  // un service call séparé n'est déclenché que si elle a réellement changé.
  async _saveAutomationDetails() {
    const entityId = this._detailPopupFor;
    const draft = this._detailDraft;
    if (!entityId || !draft || this._detailSaving) return;
    const trimmedEntityId = draft.entityId.trim();
    const entityIdChanged = trimmedEntityId !== draft.originalEntityId.trim();
    if (entityIdChanged && !/^automation\.[a-z0-9_]+$/.test(trimmedEntityId)) {
      this._showErrorToast(
        "Entity ID invalide — format attendu : automation.mon_nom (minuscules, chiffres, underscores)."
      );
      return;
    }
    this._detailSaving = true;
    this._render();
    try {
      const trimmedName = draft.name.trim();
      const trimmedIcon = draft.icon.trim();
      const wsPayload = {
        type: "config/entity_registry/update",
        entity_id: entityId,
        area_id: draft.areaId || null,
        categories: { automation: draft.categoryId || null },
        labels: draft.labelIds,
      };
      // Voir _openDetailPopup() : name/icon omis du payload (plutôt
      // qu'envoyés à blanc) tant que l'utilisateur ne les a pas réellement
      // modifiés (issue #68). Même logique pour entity_id (issue #81).
      if (trimmedName !== draft.originalName.trim()) {
        wsPayload.name = trimmedName || null;
      }
      if (trimmedIcon !== draft.originalIcon.trim()) {
        wsPayload.icon = trimmedIcon || null;
      }
      if (entityIdChanged) {
        wsPayload.new_entity_id = trimmedEntityId;
      }
      await this._hass.callWS(wsPayload);
      // Reflète immédiatement pièce/catégorie/étiquettes dans le cache local
      // (seule source lue par _getAutomations()) — sans ça la colonne et les
      // chips-filtres restent périmés jusqu'au prochain rechargement complet
      // de la page, donnant l'impression que l'enregistrement a échoué
      // (issue #67).
      const targetEntityId = entityIdChanged ? trimmedEntityId : entityId;
      const registryEntry = this._entityRegistryByEntityId.get(entityId);
      if (registryEntry) {
        const updatedEntry = {
          ...registryEntry,
          entity_id: targetEntityId,
          area_id: draft.areaId || null,
          categories: { ...registryEntry.categories, automation: draft.categoryId || null },
          labels: draft.labelIds,
        };
        // L'ancienne clé est volontairement conservée (pas supprimée) : tant
        // que hass.states n'a pas propagé le nouvel entity_id (délai HA hors
        // de notre contrôle), une ligne encore indexée sous l'ancien id doit
        // pouvoir résoudre son registre — nettoyée naturellement par le
        // prochain _loadRegistries() complet.
        this._entityRegistryByEntityId.set(entityId, updatedEntry);
        if (entityIdChanged) this._entityRegistryByEntityId.set(targetEntityId, updatedEntry);
      }
      // Lu sur l'ancien entity_id (dernière valeur connue avant que HA ne
      // propage le renommage côté states), mais tout appel de service qui
      // suit doit cibler le nouveau — HA ne reconnaît plus l'ancien dès que
      // le WS ci-dessus a réussi.
      const automation = this._findAutomation(entityId);
      const currentlyOn = automation ? automation.state === "on" : null;
      if (currentlyOn !== null && currentlyOn !== draft.activated) {
        await this._hass.callService("automation", draft.activated ? "turn_on" : "turn_off", {
          entity_id: targetEntityId,
        });
      }
      this._detailPopupFor = null;
      this._detailDraft = null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec de l'enregistrement des détails", entityId, err);
      // Message dédié si le renommage entity_id était en cause (issue #81) :
      // HA renvoie une erreur WS peu explicite sur ce champ précis (ID déjà
      // utilisé, ou cas encore mal géré côté core — voir #133209/#115334),
      // pas la peine de répercuter le message brut à l'utilisateur.
      if (entityIdChanged) {
        this._showErrorToast(
          "Impossible de renommer l'entity ID — vérifie qu'il n'est pas déjà utilisé, et que les autres champs ont bien été enregistrés."
        );
      } else {
        this._showErrorToast("Impossible d'enregistrer les modifications.");
      }
    } finally {
      this._detailSaving = false;
      this._render();
    }
  }

  // Téléchargement d'un fichier protégé par l'auth HA. Historique : d'abord
  // window.open() (cassé dans les apps Companion, WebView embarquée — voir
  // entrée changelog), puis une URL signée (auth/sign_path) redirigée via un
  // <a download> — fonctionnait dans un vrai navigateur (confirmé Safari)
  // mais restait silencieusement inopérant dans l'app Companion Mac : cette
  // approche dépend de la détection d'un téléchargement par WebKit au niveau
  // d'une navigation réseau (Content-Disposition), qui semble traitée
  // différemment dans la WebView embarquée. On passe donc par un fetch
  // authentifié (hass.fetchWithAuth(), API standard du frontend HA — ajoute
  // le bearer token, gère le refresh) qui récupère le fichier en mémoire
  // (Blob), puis un <a download> cliqué sur une URL blob: locale — une
  // sauvegarde purement côté client, qui ne passe plus du tout par la
  // navigation réseau ni par la détection de WebKit.
  async _downloadAuthenticatedPath(path, errorMessage) {
    let blobUrl = null;
    try {
      const response = await this._hass.fetchWithAuth(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      const blob = await response.blob();
      blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filenameMatch ? filenameMatch[1] : "";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec du téléchargement", path, err);
      this._showErrorToast(errorMessage);
    } finally {
      // Révocation différée : certaines WebView lisent le blob de façon
      // asynchrone après le clic (délégué de téléchargement natif) — le
      // révoquer immédiatement risquerait de couper la lecture en cours.
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    }
  }

  // Téléchargement d'un fichier individuel (mode dossier dédié uniquement,
  // menu Options > Télécharger) — voir _downloadAuthenticatedPath().
  async _downloadAutomation(automation) {
    if (!this._hass || !automation.id) {
      this._showErrorToast("Téléchargement indisponible pour cette automatisation.");
      return;
    }
    await this._downloadAuthenticatedPath(
      `/api/${API_PATHS.automations}/${automation.id}`,
      `Impossible de télécharger « ${automation.name} ».`
    );
  }

  // Dialogue natif HA (mêmes infos que si on cliquait sur l'entité ailleurs
  // dans HA) — distinct de la popup "Détails" ci-dessus, qui est notre propre
  // éditeur. `composed: true` : doit traverser la frontière du shadow DOM du
  // panel pour atteindre le gestionnaire de dialogues du frontend HA.
  _fireMoreInfo(entityId) {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  // Dispatch des actions du menu Options (kebab) d'une ligne, voir
  // _renderOptionsMenu(). "duplicate" reste désactivé côté rendu (pas
  // encore codé) — pas d'action associée ici.
  _handleOptionsAction(action, entityId) {
    const automation = this._findAutomation(entityId);
    if (!automation) {
      this._render();
      return;
    }
    if (action === "more-info") {
      this._fireMoreInfo(entityId);
      this._render();
    } else if (action === "detail") {
      this._openDetailPopup(automation);
    } else if (action === "edition") {
      this._openEdition(automation);
    } else if (action === "download") {
      this._downloadAutomation(automation);
      this._render();
    } else if (action === "toggle-state") {
      this._toggleAutomation(entityId);
    } else if (action === "delete") {
      this._openDeleteConfirm(entityId);
    } else {
      this._render();
    }
  }

  _renderAutomationList(automations) {
    if (this._groupBy === "none") {
      return `<div class="automation-table">${this._renderTableHeader()}${this._sortAutomations(automations)
        .map((a) => this._renderAutomationRow(a))
        .join("")}</div>`;
    }
    return this._groupAutomations(automations)
      .map(
        ({ title, items }) => `
          <div class="automation-group">
            <div class="automation-group-title">${escapeHtml(title)} <span class="group-count">${items.length}</span></div>
            <div class="automation-table">${this._renderTableHeader()}${this._sortAutomations(items)
              .map((a) => this._renderAutomationRow(a))
              .join("")}</div>
          </div>
        `
      )
      .join("");
  }

  // Retourne uniquement le contenu interne de la liste (pas de wrapper),
  // pour permettre un re-render partiel via _renderListOnly() sans perdre
  // le focus du champ de recherche à chaque frappe.
  _renderBody() {
    if (!this._hass) {
      return `<p class="empty-state">Chargement…</p>`;
    }
    if (!this._registriesLoaded) {
      return `<p class="empty-state">Chargement des automatisations…</p>`;
    }
    const automations = this._getFilteredAutomations();
    if (automations.length === 0) {
      const filtersActive = this._filterText || this._statusFilter !== "all" || this._activeLabelFilters.size > 0;
      const message = filtersActive
        ? "Aucune automatisation ne correspond aux filtres actuels."
        : "Aucune automatisation trouvée.";
      return `<p class="empty-state">${message}</p>`;
    }
    return this._renderAutomationList(automations);
  }

  // Re-render partiel du seul conteneur de liste : les lignes d'automatisation
  // n'ont aucun listener à ré-attacher (toggle État non interactif pour
  // l'instant), donc un simple remplacement d'innerHTML suffit.
  _renderListOnly() {
    const container = this.shadowRoot && this.shadowRoot.querySelector(".list-container");
    if (!container) return;
    // Voir set hass() : un menu Options (position: fixed) recréé par ce
    // remplacement d'innerHTML perdrait ses coordonnées — fermé par
    // précaution plutôt que repositionné (cas rare : taper dans la
    // recherche pendant qu'un menu de ligne est ouvert).
    this._optionsMenuOpenFor = null;
    container.innerHTML = this._renderBody();
  }

  _renderToast() {
    if (!this._errorToast) return "";
    return `
      <div class="toast toast-error">
        ${this._icon(ICON_ALERT_TRIANGLE, 18)}
        <span class="toast-message">${escapeHtml(this._errorToast.message)}</span>
        <button class="toast-close" title="Fermer">${this._icon(ICON_X, 14)}</button>
      </div>
    `;
  }

  // Même principe que _renderListOnly() : remplace uniquement le contenu du
  // conteneur toast (élément stable, voir _render()) pour ne pas perdre le
  // focus du champ de recherche si un toast apparaît pendant une frappe.
  _renderToastOnly() {
    const container = this.shadowRoot && this.shadowRoot.querySelector(".toast-container");
    if (!container) return;
    container.innerHTML = this._renderToast();
  }

  // Un seul toast à la fois : un nouvel appel remplace le précédent et
  // relance le délai d'auto-fermeture plutôt que d'empiler les messages.
  _showErrorToast(message) {
    if (this._errorToastTimeoutId) {
      clearTimeout(this._errorToastTimeoutId);
    }
    this._errorToast = { message };
    this._renderToastOnly();
    this._errorToastTimeoutId = setTimeout(() => {
      this._errorToastTimeoutId = null;
      this._dismissErrorToast();
    }, ERROR_TOAST_AUTO_DISMISS_MS);
  }

  _dismissErrorToast() {
    if (this._errorToastTimeoutId) {
      clearTimeout(this._errorToastTimeoutId);
      this._errorToastTimeoutId = null;
    }
    this._errorToast = null;
    this._renderToastOnly();
  }

  // Décrit le résultat de /config_check en français, en s'appuyant sur le
  // détail renvoyé par le backend (directive_ok / target_exists) plutôt que
  // sur un simple "erreur" générique — les deux peuvent diverger
  // indépendamment (voir ARCHITECTURE.md §3).
  _describeConfigCheck(result) {
    if (result.ok) return "la configuration correspond au mode actif.";
    const reasons = [];
    if (!result.directive_ok) {
      reasons.push("la ligne « automation: » de configuration.yaml ne correspond pas au mode actif");
    }
    if (!result.target_exists) {
      reasons.push(`« ${result.target_path} » est introuvable`);
    }
    return reasons.length > 0
      ? `${reasons.join(" ; ")}.`
      : "la configuration ne correspond pas au mode actif.";
  }

  async _checkConfig() {
    if (!this._hass || this._configCheckState.loading) return;
    this._configCheckState = { loading: true, result: null, error: false };
    this._renderPreservingFocus();
    try {
      const result = await this._hass.callApi("GET", API_PATHS.configCheck);
      this._configCheckState = { loading: false, result, error: false };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec de la vérification de configuration", err);
      this._configCheckState = { loading: false, result: null, error: true };
    }
    this._renderPreservingFocus();
  }

  async _checkYaml() {
    if (!this._hass || this._yamlCheckState.loading) return;
    this._yamlCheckState = { loading: true, files: null, error: false, checkedAt: this._yamlCheckState.checkedAt };
    this._renderPreservingFocus();
    try {
      const { files } = await this._hass.callApi("GET", API_PATHS.yamlCheck);
      this._yamlCheckState = { loading: false, files, error: false, checkedAt: new Date() };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec de la vérification YAML", err);
      this._yamlCheckState = { loading: false, files: null, error: true, checkedAt: this._yamlCheckState.checkedAt };
    }
    this._renderPreservingFocus();
  }

  // Voir _downloadAuthenticatedPath().
  async _exportAutomations() {
    if (!this._hass) return;
    await this._downloadAuthenticatedPath(`/api/${API_PATHS.export}`, "Impossible d'exporter les automatisations.");
  }

  // Navigation vers une page HA native (issue #82, bloc Raccourcis) sans
  // recharger toute la page : le frontend HA est une SPA qui synchronise son
  // routeur sur history.pushState() via l'événement "location-changed" —
  // mécanisme standard déjà utilisé par HA lui-même (ex. action "navigate"
  // des cartes Lovelace) plutôt qu'un window.location.href classique.
  _navigateHa(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
  }

  _renderSoonBadge() {
    return `<span class="soon-badge">Bientôt disponible</span>`;
  }

  // Bloc Stockage : verrouillé sur "Fichier standard" — le segment "Dossier
  // dédié" reste visuellement présent (design déjà fait, ARCHITECTURE.md
  // §2) mais inerte (pas de listener posé dessus), en attendant les popups
  // de confirmation de bascule (#34/#35, pas encore codées).
  _renderStorageBlock() {
    const checkState = this._configCheckState;
    let checkResultHtml = "";
    if (checkState.loading) {
      checkResultHtml = `<p class="check-result">Vérification en cours…</p>`;
    } else if (checkState.error) {
      checkResultHtml = `<p class="check-result check-error">${this._icon(ICON_X, 14)}<span>Impossible de contacter Home Assistant.</span></p>`;
    } else if (checkState.result) {
      const ok = checkState.result.ok;
      checkResultHtml = `
        <p class="check-result ${ok ? "check-ok" : "check-error"}">
          ${this._icon(ok ? ICON_CHECK : ICON_X, 14)}
          <span><strong>${ok ? "OK," : "Erreur,"}</strong> ${escapeHtml(this._describeConfigCheck(checkState.result))}</span>
        </p>
      `;
    }
    return `
      <div class="settings-block">
        <div class="settings-block-header">
          <h2>Stockage des automatisations</h2>
          <p>Choisir où sont stockées les automatisations.</p>
        </div>
        <div class="storage-selector-row">
          <div class="storage-selector">
            <div class="storage-segment active">
              ${this._icon(ICON_FILE_TEXT, 14)}
              <span>Fichier standard</span>
            </div>
            <div class="storage-segment disabled" title="Bientôt disponible">
              ${this._icon(ICON_FOLDER, 14)}
              <span>Dossier dédié</span>
            </div>
          </div>
          <p class="storage-path-info">${this._icon(ICON_FILE_TEXT, 12)}<span>Chemin : <code>config/automations.yaml</code></span></p>
        </div>
        <div class="settings-divider"></div>
        <div class="settings-action-row">
          <button class="settings-btn" data-action="check-config">
            ${this._icon(ICON_SHIELD_CHECK, 14)}
            <span>Vérifier la configuration</span>
          </button>
        </div>
        ${checkResultHtml}
      </div>
    `;
  }

  // Horodatage affiché au-dessus de la liste — conservé tel quel (pas remis
  // à null) tant que l'utilisateur ne relance pas une analyse : un
  // changement de vue (Dashboard <-> Réglages) ne doit pas le faire
  // disparaître, seul un nouveau clic sur "Analyser" le met à jour.
  _formatCheckTimestamp(date) {
    const datePart = date.toLocaleDateString("fr-FR");
    const timePart = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} à ${timePart}`;
  }

  // Bloc Vérification YAML : fonctionnel pour le fichier actif (mode
  // standard) — même mécanique/rendu qu'un futur mode dossier multi-fichiers
  // (le backend renvoie déjà une liste, à un seul élément pour l'instant ;
  // en mode dossier elle listera tous les fichiers YAML trouvés). Chaque
  // ligne reprend la palette OK/Erreur du bloc Stockage (_renderStorageBlock)
  // pour rester cohérent visuellement entre les deux vérifications.
  _renderYamlCheckBlock() {
    const state = this._yamlCheckState;
    let resultsHtml = "";
    if (state.loading) {
      resultsHtml = `<p class="check-result">Analyse en cours…</p>`;
    } else if (state.error) {
      resultsHtml = `<p class="check-result check-error">${this._icon(ICON_X, 14)}<span>Impossible de contacter Home Assistant.</span></p>`;
    } else if (state.files) {
      const timestampHtml = state.checkedAt
        ? `<p class="yaml-check-timestamp">Vérifié le ${this._formatCheckTimestamp(state.checkedAt)}</p>`
        : "";
      resultsHtml = `
        ${timestampHtml}
        <div class="yaml-check-results">${state.files
          .map(
            (file) => `
              <div class="yaml-check-row ${file.ok ? "check-ok" : "check-error"}">
                ${this._icon(file.ok ? ICON_CHECK : ICON_X, 14)}
                <span class="yaml-check-name">${escapeHtml(file.name)}</span>
                <span class="yaml-check-status"><strong>${file.ok ? "OK," : "Erreur,"}</strong> ${file.ok ? "syntaxe valide." : escapeHtml(file.error)}</span>
              </div>
            `
          )
          .join("")}</div>
      `;
    }
    return `
      <div class="settings-block">
        <div class="settings-block-header">
          <h2>Vérification des fichiers YAML</h2>
          <p>Analyser les fichiers qui seront lus par l'intégration.</p>
        </div>
        <div class="settings-action-row">
          <button class="settings-btn" data-action="check-yaml">
            ${this._icon(ICON_SHIELD_CHECK, 14)}
            <span>Analyser</span>
          </button>
        </div>
        ${resultsHtml}
      </div>
    `;
  }

  _renderDisplayBlock() {
    return `
      <div class="settings-block">
        <div class="settings-block-header settings-block-header-inline">
          <h2>Affichage</h2>
          ${this._renderSoonBadge()}
        </div>
        <p>Les options d'affichage (densité de liste, thème du graphe) arriveront dans une prochaine version.</p>
      </div>
    `;
  }

  // Import inerte (pas de listener posé) — pas encore utile tant que le
  // mode dossier dédié, seul mode où "importer" a un sens, n'est pas
  // sélectionnable.
  _renderImportExportBlock() {
    return `
      <div class="settings-block">
        <div class="settings-block-header">
          <h2>Import / Export</h2>
          <p>Sauvegarder ou restaurer vos automatisations au format YAML.</p>
        </div>
        <div class="settings-action-row">
          <button class="settings-btn" data-action="export">
            ${this._icon(ICON_DOWNLOAD, 14)}
            <span>Exporter les automatisations</span>
          </button>
          <button class="settings-btn disabled" title="Bientôt disponible" disabled>
            ${this._icon(ICON_UPLOAD, 14)}
            <span>Importer des automatisations</span>
          </button>
        </div>
      </div>
    `;
  }

  // Raccourcis vers les pages de gestion natives HA (issue #82) — évite de
  // sortir du panel pour créer/modifier une étiquette ou une pièce utilisée
  // dans les filtres/le popup Détail. Catégories volontairement exclues :
  // pas d'URL générique unique côté HA (gérées par domaine).
  _renderShortcutsBlock() {
    return `
      <div class="settings-block">
        <div class="settings-block-header">
          <h2>Raccourcis</h2>
          <p>Ouvrir les pages de gestion natives de Home Assistant sans quitter le panel.</p>
        </div>
        <div class="settings-action-row">
          <button class="settings-btn" data-action="nav-labels">
            ${this._icon(ICON_TAGS, 14)}
            <span>Étiquettes</span>
            ${this._icon(ICON_EXTERNAL_LINK, 12)}
          </button>
          <button class="settings-btn" data-action="nav-areas">
            ${this._icon(ICON_SOFA, 14)}
            <span>Pièces</span>
            ${this._icon(ICON_EXTERNAL_LINK, 12)}
          </button>
        </div>
      </div>
    `;
  }

  _renderAboutBlock() {
    return `
      <div class="settings-block">
        <h2>À propos</h2>
        <div class="about-version-row">
          <span class="about-version-badge">v${DEBUG_VERSION} · ${DEBUG_BUILD_DATE}</span>
        </div>
        <div class="about-links">
          <a class="about-link" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">
            ${this._icon(ICON_SCROLL_TEXT, 13)}<span>Voir les nouveautés</span>
          </a>
          <a class="about-link" href="${ISSUES_URL}" target="_blank" rel="noopener noreferrer">
            ${this._icon(ICON_BUG, 13)}<span>Signaler un bug / Voir les issues</span>
          </a>
        </div>
        <p class="about-credits">AutomationPlus — intégration Home Assistant open source</p>
        <p class="about-credits">${DEBUG_BUILD_DATE.slice(0, 4)} · GPL-3.0 License · Développeur indépendant · 🇫🇷 Claudé en France</p>
      </div>
    `;
  }

  _renderSettingsView() {
    return `
      <div class="settings-view">
        ${this._renderStorageBlock()}
        ${this._renderYamlCheckBlock()}
        ${this._renderDisplayBlock()}
        ${this._renderImportExportBlock()}
        ${this._renderShortcutsBlock()}
        ${this._renderAboutBlock()}
      </div>
    `;
  }

  _renderDashboardView() {
    return `
      <div class="toolbar">
        <div class="search-wrap">
          ${this._icon(ICON_SEARCH, 16)}
          <input class="search-input" type="text" placeholder="Rechercher une automatisation..." value="${escapeHtml(this._filterText)}" />
        </div>
        <span class="toolbar-separator"></span>
        <div class="regroup-wrap">
          <button class="regroup-btn">
            ${this._icon(ICON_LAYERS, 16)}
            <span>${this._groupLabel()}</span>
            ${this._icon(ICON_CHEVRON_DOWN, 14)}
          </button>
          ${this._renderGroupMenu()}
        </div>
        <div class="regroup-wrap">
          <button class="sort-btn">
            ${this._icon(ICON_ARROW_UP_DOWN, 16)}
            <span>${this._sortLabel()}</span>
            ${this._icon(ICON_CHEVRON_DOWN, 14)}
          </button>
          ${this._renderSortMenu()}
        </div>
        ${this._renderStatusFilters()}
      </div>
      ${this._renderChips()}
      <div class="scroll-area">
        <div class="list-container">${this._renderBody()}</div>
      </div>
      <button class="fab" title="Nouvelle automatisation">
        ${this._icon(ICON_PLUS, 24)}
      </button>
    `;
  }

  // Toolbar de la page Édition — remplace le Header Global (voir _render()),
  // propre à ce _view. Sélecteur Liste/Graphe/Code : seul Code est
  // fonctionnel dans ce lot (#87), Liste/Graphe restent des segments
  // visuels inertes (pas encore codés, #86 pour la suite). Déverrouiller
  // affiché mais désactivé : l'édition n'est pas encore possible (#88).
  _renderEditionToolbar() {
    const automation = this._editionAutomation;
    const name = automation ? automation.name : "";
    // "Déverrouiller" est spécifique au flux Code (#87/#88, verrou avant
    // édition brute) — masqué en vue Liste, où l'édition de champs est
    // directement possible sans déverrouillage (issue #101). Undo/Redo
    // (issue #90, lot 1) : mécanisme accroché à _editionMutateList, donc
    // vue-agnostique en soi, mais activé seulement en vue Liste pour
    // l'instant — Code reste intégralement lecture seule (#87) et Graphe
    // n'existe pas encore (#86), aucune des deux n'alimente donc la pile.
    const showLock = this._editionSubView === "code";
    const cancelEnabled = this._editionSubView === "liste" && this._editionDirty;
    const undoEnabled = this._editionSubView === "liste" && this._editionHistory.past.length > 0;
    const redoEnabled = this._editionSubView === "liste" && this._editionHistory.future.length > 0;
    return `
      <div class="header edition-toolbar">
        <div class="header-left">
          <button class="icon-button back-btn" title="Retour au Dashboard">
            ${this._icon(ICON_ARROW_LEFT, 22)}
          </button>
          <button class="edition-title" data-action="edit-title" title="Détails de l'automatisation">
            <span>${escapeHtml(name)}</span>
            ${this._icon(ICON_EDIT, 14)}
          </button>
        </div>
        <div class="edition-view-selector">
          <span class="edition-segment${this._editionSubView === "liste" ? " active" : ""}" data-sub-view="liste">
            ${this._icon(ICON_LIST, 14)}<span>Liste</span>
          </span>
          <span class="edition-segment disabled" title="Pas encore disponible">
            ${this._icon(ICON_GIT_FORK, 14)}<span>Graphe</span>
          </span>
          <span class="edition-segment${this._editionSubView === "code" ? " active" : ""}" data-sub-view="code">
            ${this._icon(ICON_FILE_CODE, 14)}<span>Code</span>
          </span>
        </div>
        <div class="header-actions">
          ${
            showLock
              ? `
          <button class="edition-lock-btn" title="Pas encore disponible" disabled>
            ${this._icon(ICON_LOCK, 14)}<span>Déverrouiller</span>
          </button>
          <span class="edition-actions-separator"></span>
          `
              : ""
          }
          <button
            class="icon-button"
            data-action="undo-edition"
            title="${undoEnabled ? "Annuler la dernière modification" : "Rien à annuler"}"
            ${undoEnabled ? "" : "disabled"}
          >
            ${this._icon(ICON_UNDO_2, 20)}
          </button>
          <button
            class="icon-button"
            data-action="redo-edition"
            title="${redoEnabled ? "Rétablir la modification annulée" : "Rien à rétablir"}"
            ${redoEnabled ? "" : "disabled"}
          >
            ${this._icon(ICON_REDO_2, 20)}
          </button>
          <button
            class="popup-btn popup-btn-secondary"
            data-action="discard-edition-changes"
            title="${cancelEnabled ? "Annuler les modifications non enregistrées" : "Pas encore disponible"}"
            ${cancelEnabled ? "" : "disabled"}
          >Annuler</button>
          <button class="popup-btn popup-btn-primary" title="Pas encore disponible" disabled>
            ${this._icon(ICON_CHECK, 14)}<span>Enregistrer</span>
          </button>
          <span class="edition-actions-separator"></span>
          <button class="icon-button edition-help-btn" title="Aide">
            ${this._icon(ICON_HELP_CIRCLE, 22)}
          </button>
          <button class="icon-button settings-btn-header" title="Paramètres">
            ${this._icon(ICON_SETTINGS, 22)}
          </button>
        </div>
      </div>
    `;
  }

  // Bandeau commun aux deux onglets d'Édition (Liste/Code). L'onglet Code
  // reste intégralement lecture seule (#87) ; l'onglet Liste permet
  // maintenant des modifications en mémoire (#101) — le bandeau reflète
  // alors l'état "non enregistré" plutôt que "lecture seule", tant qu'aucune
  // édition n'existe le message générique reste affiché. Écriture réelle
  // toujours hors périmètre (#88/#89/#92).
  _renderEditionReadonlyBanner() {
    if (this._editionSubView === "liste" && this._editionDirty) {
      return `
        <div class="edition-readonly-banner edition-readonly-banner-dirty">
          ${this._icon(ICON_ALERT_TRIANGLE, 14)}
          <span>Modifications non enregistrées — l'enregistrement sera bientôt disponible.</span>
        </div>
      `;
    }
    return `
      <div class="edition-readonly-banner">
        ${this._icon(ICON_LOCK, 14)}
        <span>Lecture seule — l'édition sera bientôt disponible.</span>
      </div>
    `;
  }

  _renderEditionView() {
    return this._editionSubView === "code" ? this._renderEditionCode() : this._renderEditionListe();
  }

  // Contenu de l'onglet Code (lecture seule — #87) : bandeau + Sidebar "Aller
  // à"/recherche (issue #112) + gouttière/lignes dans une seule zone
  // scrollable commune (gouttière et code doivent défiler ensemble, pas
  // indépendamment).
  _renderEditionCode() {
    const state = this._editionYaml;
    let bodyHtml;
    if (state.loading) {
      bodyHtml = `<p class="edition-status-text">Chargement du YAML…</p>`;
    } else if (state.error) {
      bodyHtml = `<p class="edition-status-text edition-status-error">${escapeHtml(state.error)}</p>`;
    } else if (state.lines) {
      bodyHtml = `
        <div class="edition-editor-card">
          <div class="edition-gutter">${this._renderEditionCodeGutter()}</div>
          <div class="edition-code">${this._renderEditionCodeLines()}</div>
        </div>
      `;
    } else {
      bodyHtml = "";
    }
    return `
      ${this._renderEditionReadonlyBanner()}
      <div class="edition-code-body">
        ${this._renderEditionCodeSidebar()}
        <div class="scroll-area edition-scroll-area">${bodyHtml}</div>
      </div>
    `;
  }

  // Numéros de ligne (issue #112) : porte le "trait vertical" de la section
  // active de la sidebar "Aller à" — retour utilisateur explicite : dans la
  // colonne des numéros, pas au bord du code. Même classes que
  // _renderEditionCodeLines(), la CSS différencie l'effet par colonne
  // ancêtre (.edition-gutter vs .edition-code).
  _renderEditionCodeGutter() {
    const state = this._editionYaml;
    const range = this._editionCodeActiveCategory
      ? this._findEditionCodeLineRange(this._editionCodeActiveCategory)
      : null;
    return state.lines
      .map((_, index) => {
        const active = range && index >= range.start && index <= range.end;
        const cls = active
          ? ` edition-line-highlight edition-line-highlight-${this._editionCodeActiveCategory}`
          : "";
        return `<span class="edition-line-number${cls}">${index + 1}</span>`;
      })
      .join("");
  }

  // Lignes de code (issue #112) : combine le surlignage de la section active
  // (persistant, dérivé de _editionCodeActiveCategory) et celui de la
  // recherche en cours (_editionCodeSearchQuery) — une ligne peut porter les
  // deux à la fois. Régénérée à chaque render ET patchée directement (sans
  // _render()) par le listener "input" de la recherche, voir
  // _attachListeners().
  _renderEditionCodeLines() {
    const state = this._editionYaml;
    const range = this._editionCodeActiveCategory
      ? this._findEditionCodeLineRange(this._editionCodeActiveCategory)
      : null;
    const matches = this._editionCodeSearchMatches();
    return state.lines
      .map((line, index) => {
        const classes = ["edition-line-text"];
        if (range && index >= range.start && index <= range.end) {
          classes.push("edition-line-highlight", `edition-line-highlight-${this._editionCodeActiveCategory}`);
        }
        if (matches && matches.has(index)) classes.push("edition-line-search-match");
        return `<span class="${classes.join(" ")}" data-line-index="${index}">${
          line ? escapeHtml(line) : " "
        }</span>`;
      })
      .join("");
  }

  // Sidebar "Aller à" + recherche de la vue Code (issue #112) : le champ
  // recherche existait déjà dans le .pen (initialement pris pour un résidu
  // de la Palette de la vue Liste — en réalité prévu pour cette vue).
  // Sélection persistante des boutons : reclic pour désélectionner, un seul
  // actif à la fois (retour utilisateur, pas l'état transitoire du plan
  // d'origine) — un bouton sans section correspondante dans le YAML reste
  // désactivé plutôt que cliquable sans effet.
  _renderEditionCodeSidebar() {
    const itemsHtml = EDITION_CODE_GOTO_ITEMS.map(({ category, icon }) => {
      const label = EDITION_CATEGORY_LABELS[category];
      const available = !!this._findEditionCodeLineRange(category);
      const active = this._editionCodeActiveCategory === category;
      const title = available
        ? `Aller à la section ${label}`
        : `Aucune section ${label} dans cette automatisation`;
      return `
        <button
          class="edition-goto-btn edition-goto-btn-${category}${active ? " edition-goto-btn-active" : ""}"
          data-action="goto-category"
          data-category="${category}"
          title="${escapeHtml(title)}"
          ${available ? "" : "disabled"}
        >
          ${this._icon(icon, 18)}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    }).join("");
    return `
      <aside class="edition-code-sidebar">
        <div class="edition-palette-search">
          ${this._icon(ICON_SEARCH, 15)}
          <input
            type="text"
            class="edition-code-search-input"
            placeholder="Rechercher dans le YAML…"
            value="${escapeHtml(this._editionCodeSearchQuery)}"
          />
        </div>
        <div class="edition-code-sidebar-title">Aller à</div>
        ${itemsHtml}
      </aside>
    `;
  }

  // Contenu de l'onglet Liste : Zone Centrale (3 groupes) pilotée par
  // données, cartes sélectionnables, Panneau Paramètres et Sidebar Palette
  // (ajout de bloc + suppression) fonctionnels en mémoire (#101/#102).
  _renderEditionListe() {
    const state = this._editionYaml;
    let centralHtml;
    if (state.loading) {
      centralHtml = `<p class="edition-status-text">Chargement de l'automatisation…</p>`;
    } else if (state.error) {
      centralHtml = `<p class="edition-status-text edition-status-error">${escapeHtml(state.error)}</p>`;
    } else if (state.config) {
      centralHtml = this._renderEditionListeGroups(state.config);
    } else {
      centralHtml = "";
    }
    return `
      ${this._renderEditionReadonlyBanner()}
      <div class="edition-liste-body">
        ${this._renderEditionPalette()}
        <div class="scroll-area edition-liste-central">${centralHtml}</div>
        ${this._renderEditionSettingsPanel()}
      </div>
    `;
  }

  // Une "card" par bloc trigger/condition/action, décrite via le catalogue
  // statique (automation-blocks-catalog.js — #22). Cliquable pour la
  // sélectionner et l'éditer dans le Panneau Paramètres (issue #101) — le
  // clic est géré par délégation sur .edition-liste-body, voir
  // _attachListeners(). Poignée de glisser-déposer fonctionnelle (issue
  // #110, réordonnancement au sein d'un même groupe uniquement) — voir
  // _attachEditionDragHandlers(). Toggle actif/inactif
  // (clé HA `enabled`) + menu kebab Dupliquer/Activer-Désactiver/Supprimer
  // fonctionnels (issue #105).
  // Pastille d'icône colorée par catégorie, comme dans le .pen (Carte
  // Déclencheur/Condition/Action de « Edition automatisation - liste »).
  _renderEditionBlockCard(category, entry, index, selected, modified, enabled) {
    const menuOpen =
      this._editionBlockMenuOpenFor && this._editionBlockMenuOpenFor.category === category && this._editionBlockMenuOpenFor.index === index;
    return `
      <div class="edition-block-card${selected ? " selected" : ""}${modified ? " modified" : ""}${enabled ? "" : " disabled"}" data-category="${category}" data-index="${index}">
        <span class="edition-block-handle" data-action="drag-handle" data-category="${category}" data-index="${index}">${this._icon(ICON_GRIP_VERTICAL, 14)}</span>
        <span class="edition-block-icon edition-block-icon-${category}">${this._icon(entry.icon, 16)}</span>
        <div class="edition-block-text">
          <span class="edition-block-title">${escapeHtml(entry.title)}</span>
          <span class="edition-block-summary">${escapeHtml(entry.summary)}</span>
        </div>
        <span class="state-toggle ${enabled ? "on" : "off"}" data-action="toggle-block-enabled" data-category="${category}" data-index="${index}" title="${enabled ? "Cliquer pour désactiver" : "Cliquer pour activer"}">
          <span class="state-toggle-knob"></span>
        </span>
        <div class="options-wrap">
          <button class="icon-button edition-block-kebab" data-action="block-menu" data-category="${category}" data-index="${index}" title="Options">
            ${this._icon(ICON_MORE_VERTICAL, 16)}
          </button>
          ${menuOpen ? this._renderEditionBlockMenu(category, index, enabled) : ""}
        </div>
      </div>
    `;
  }

  // Menu kebab d'une carte de bloc (issue #105), même style que le menu
  // Options d'une ligne d'automatisation du Dashboard (_renderOptionsMenu) —
  // réutilise les mêmes classes .options-menu/.options-menu-item/
  // .dropdown-backdrop, pas de duplication de CSS.
  _renderEditionBlockMenu(category, index, enabled) {
    const items = [
      { action: "duplicate", icon: ICON_COPY, label: "Dupliquer" },
      { action: "toggle-enabled", icon: enabled ? ICON_TOGGLE_RIGHT : ICON_TOGGLE_LEFT, label: enabled ? "Désactiver" : "Activer" },
      { action: "delete", icon: ICON_TRASH, label: "Supprimer", danger: true },
    ];
    const itemsHtml = items
      .map((item) => {
        const classes = ["options-menu-item", item.danger ? "options-menu-item-danger" : ""].filter(Boolean).join(" ");
        return `
          <div class="${classes}" data-action="${item.action}" data-category="${category}" data-index="${index}">
            ${this._icon(item.icon, 16)}
            <span>${item.label}</span>
          </div>
        `;
      })
      .join("");
    return `
      <div class="dropdown-backdrop"></div>
      <div class="options-menu">${itemsHtml}</div>
    `;
  }

  // En-tête de groupe : badge pilule coloré par catégorie + ligne de
  // séparation pleine largeur, comme le .pen (Entete Déclencheur/Condition/
  // Action) — pas un simple libellé en gras. Liseré en violet si le contenu
  // de ce groupe diffère de l'origine (_editionCategoryChanged, comparaison
  // de contenu — pas un drapeau "a été touché une fois") — reste visible
  // même après suppression d'un bloc, contrairement au liseré de carte
  // individuel qui disparaît avec le bloc, mais disparaît lui-même si on
  // revient au contenu d'origine (retour utilisateur, issue #105).
  _renderEditionGroup(category, icon, title, cardsHtml, addLabel) {
    const dirty = this._editionCategoryChanged(category);
    return `
      <div class="edition-group">
        <div class="edition-group-header">
          <span class="edition-group-badge edition-group-badge-${category}">
            ${this._icon(icon, 10)}<span>${title}</span>
          </span>
          <span class="edition-group-divider${dirty ? " modified" : ""}"></span>
        </div>
        <div class="edition-group-cards">${cardsHtml || `<p class="edition-group-empty">Aucun bloc</p>`}</div>
        <button class="edition-group-add" data-action="focus-palette-category" data-category="${category}" title="Choisir dans la Palette">
          ${this._icon(ICON_PLUS, 14)}<span>${addLabel}</span>
        </button>
      </div>
    `;
  }

  // Décrit un bloc via le catalogue, en respectant `alias` (clé HA réelle,
  // portée par trigger/condition/action) quand présent — sinon le titre
  // générique par type resterait affiché même après une duplication, qui
  // pose justement un alias "<nom> (dupliqué)" pour distinguer les deux
  // blocs à l'écran (issue #105).
  // `context.triggers` (issue #102, ajustement post-review) : uniquement
  // consommé par describeCondition() pour résoudre les `id` bruts de
  // `condition: trigger` vers un libellé lisible — undefined pour trigger/
  // action, sans effet (describeCondition() gère son absence).
  _editionDescribeBlock(category, block, hass, context) {
    const described =
      category === "trigger" ? describeTrigger(block, hass) : category === "condition" ? describeCondition(block, hass, context) : describeAction(block, hass);
    return block.alias ? { ...described, title: block.alias } : described;
  }

  _renderEditionListeGroups(config) {
    const hass = this._hass;
    const triggerList = pickList(config, "trigger", "triggers");
    const conditionContext = { triggers: triggerList };
    const triggers = triggerList
      .map((t, i) =>
        this._renderEditionBlockCard("trigger", this._editionDescribeBlock("trigger", t, hass), i, this._isBlockSelected("trigger", i), this._editionIsBlockModified("trigger", i, t), t.enabled !== false)
      )
      .join("");
    const conditions = pickList(config, "condition", "conditions")
      .map((c, i) =>
        this._renderEditionBlockCard(
          "condition",
          this._editionDescribeBlock("condition", c, hass, conditionContext),
          i,
          this._isBlockSelected("condition", i),
          this._editionIsBlockModified("condition", i, c),
          c.enabled !== false
        )
      )
      .join("");
    const actions = pickList(config, "action", "actions")
      .map((a, i) =>
        this._renderEditionBlockCard("action", this._editionDescribeBlock("action", a, hass), i, this._isBlockSelected("action", i), this._editionIsBlockModified("action", i, a), a.enabled !== false)
      )
      .join("");
    return `
      ${this._renderEditionGroup("trigger", ICON_ZAP, "Déclencheur", triggers, "Ajouter un déclencheur")}
      ${this._renderEditionGroup("condition", ICON_GIT_BRANCH, "Condition", conditions, "Ajouter une condition")}
      ${this._renderEditionGroup("action", ICON_PLAY, "Action", actions, "Ajouter une action")}
    `;
  }

  // Sidebar gauche "ajouter un bloc" (issue #102) : clic sur un item insère
  // réellement un bloc via _editionInsertBlock() (délégué sur
  // .edition-liste-body, voir _attachListeners()). Liste réelle des 40
  // types pilotée par BLOCK_TYPES (catalogue statique, #22), fidèle au
  // contenu à plat du .pen (pas de catégories repliables). `category` porté
  // par data-category/data-type-key sur chaque item pour le handler de clic.
  _renderEditionPaletteSection(category, icon, title, items) {
    if (!items.length) return "";
    const itemsHtml = items
      .map(
        (item) => `
          <div class="edition-palette-item" data-action="insert-block" data-category="${category}" data-type-key="${escapeHtml(item.typeKey)}" title="Ajouter : ${escapeHtml(item.title)}">
            ${this._icon(item.icon, 15)}<span>${escapeHtml(item.title)}</span>${this._icon(ICON_PLUS, 13)}
          </div>
        `
      )
      .join("");
    return `
      <div class="edition-palette-section">
        <div class="edition-palette-section-header">${this._icon(icon, 13)}<span>${title}</span></div>
        <div class="edition-palette-items">${itemsHtml}</div>
      </div>
    `;
  }

  // Filtre insensible à la casse/aux accents sur le titre et la clé de type
  // (issue #102) — comparaison simple `includes`, pas de recherche floue.
  _editionFilterBlockTypes(items, query) {
    const normalized = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = `${item.title} ${item.typeKey}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return haystack.includes(normalized);
    });
  }

  // Switcher de catégories (issue #102, ajustement post-review) — mêmes
  // classes de base que .edition-segment/.edition-view-selector (toolbar
  // Édition), réutilisées à l'identique pour la cohérence visuelle. Grisé
  // et inerte tant qu'une recherche est en cours (this._editionPaletteQuery)
  // : la recherche bascule alors en mode "toutes catégories confondues",
  // voir _renderEditionPaletteSections().
  _renderEditionPaletteTabs(searching) {
    const itemsHtml = EDITION_PALETTE_TABS.map(
      (tab) => `
        <div class="edition-palette-tab${tab.category === this._editionPaletteActiveCategory ? " active" : ""}" data-action="palette-tab" data-category="${tab.category}">
          ${this._icon(tab.icon, 14)}<span>${tab.label}</span>
        </div>
      `
    ).join("");
    return `<div class="edition-palette-tabs${searching ? " disabled" : ""}">${itemsHtml}</div>`;
  }

  // Sections affichées sous le switcher (issue #102, ajustement post-review)
  // — factorisé pour être réutilisé par le rendu complet ET par le patch
  // DOM ciblé de la recherche (voir _attachListeners(), listener "input"),
  // qui ne doit jamais reconstruire l'input lui-même sous peine de perdre
  // le focus/curseur en cours de frappe. Deux modes :
  // - recherche active (query non vide) : les 3 catégories confondues,
  //   filtrées — le switcher est alors grisé (voir _renderEditionPaletteTabs).
  // - pas de recherche : uniquement la catégorie de l'onglet actif, non
  //   filtrée (toujours au moins 1 type par catégorie, jamais d'état vide
  //   dans ce mode).
  _renderEditionPaletteSections() {
    const query = this._editionPaletteQuery;
    if (query.trim()) {
      const sectionsHtml = EDITION_PALETTE_TABS.map((tab) =>
        this._renderEditionPaletteSection(tab.category, tab.icon, tab.sectionTitle, this._editionFilterBlockTypes(BLOCK_TYPES[tab.category], query))
      ).join("");
      if (!sectionsHtml) {
        return `<p class="edition-palette-empty">Aucun type de bloc ne correspond à « ${escapeHtml(query.trim())} ».</p>`;
      }
      return sectionsHtml;
    }
    const activeTab = EDITION_PALETTE_TABS.find((tab) => tab.category === this._editionPaletteActiveCategory) || EDITION_PALETTE_TABS[0];
    return this._renderEditionPaletteSection(activeTab.category, activeTab.icon, activeTab.sectionTitle, BLOCK_TYPES[activeTab.category]);
  }

  _renderEditionPalette() {
    const searching = this._editionPaletteQuery.trim().length > 0;
    return `
      <div class="edition-palette">
        <div class="edition-palette-search">
          ${this._icon(ICON_SEARCH, 15)}
          <input type="text" class="edition-palette-search-input" placeholder="Rechercher un bloc..." value="${escapeHtml(this._editionPaletteQuery)}" />
        </div>
        ${this._renderEditionPaletteTabs(searching)}
        <div class="edition-palette-sections">${this._renderEditionPaletteSections()}</div>
        <span class="edition-palette-footer">Registre blocs · HA ${BLOCK_REGISTRY_HA_VERSION}</span>
      </div>
    `;
  }

  // Un champ du formulaire dynamique (issue #101), piloté par le schéma
  // getBlockFields() du catalogue. Écriture sur "change" (pas "input") pour
  // les champs texte/nombre : un re-render complet à chaque frappe casserait
  // le focus/curseur (pas de rendu partiel dans ce projet, voir plan).
  _renderEditionFieldRow(block, field) {
    const value = this._editionGetFieldValue(block, field.key);
    // Un champ "duration" peut porter un objet HA ({hours,minutes,seconds})
    // plutôt qu'une chaîne HH:MM:SS — affiché lisible via formatDuration()
    // plutôt que "[object Object]". Reste un champ texte libre à l'édition :
    // toute saisie réécrit une chaîne simple (normalisation assumée, cf. plan).
    const display =
      value === undefined || value === null
        ? ""
        : field.type === "duration" && typeof value === "object"
          ? formatDuration(value)
          : value;
    const keyAttr = escapeHtml(field.key);
    let inputHtml;
    if (field.type === "entity") {
      const listId = `edition-entities-${field.key.replace(/[^a-zA-Z0-9]/g, "_")}`;
      inputHtml = `
        <input type="text" class="detail-input" list="${listId}" data-field-key="${keyAttr}" data-field-type="text" value="${escapeHtml(String(display))}" placeholder="${escapeHtml(field.placeholder || "entity_id")}" />
        <datalist id="${listId}">${this._editionEntityOptions()}</datalist>
      `;
    } else if (field.type === "number") {
      inputHtml = `<input type="number" class="detail-input" data-field-key="${keyAttr}" data-field-type="number" value="${display === "" ? "" : escapeHtml(String(display))}" />`;
    } else if (field.type === "boolean") {
      inputHtml = `<span class="state-toggle edition-field-toggle${value ? " on" : ""}" data-field-key="${keyAttr}" data-field-type="boolean" data-value="${value ? "true" : "false"}"><span class="state-toggle-knob"></span></span>`;
    } else if (field.type === "template") {
      inputHtml = `<textarea class="detail-input edition-field-textarea" data-field-key="${keyAttr}" data-field-type="text">${escapeHtml(String(display))}</textarea>`;
    } else if (field.type === "select") {
      const options = (field.options || [])
        .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === display ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
        .join("");
      inputHtml = `<select class="detail-select" data-field-key="${keyAttr}" data-field-type="text"><option value=""></option>${options}</select>`;
    } else if (field.type === "weekday") {
      const selectedDays = Array.isArray(value) ? value : [];
      const chipsHtml = WEEKDAY_ORDER.map(
        (day) => `
          <button type="button" class="edition-field-weekday-chip${selectedDays.includes(day) ? " active" : ""}" data-action="toggle-weekday" data-field-key="${keyAttr}" data-day="${day}">${WEEKDAY_LABELS[day]}</button>
        `
      ).join("");
      inputHtml = `<div class="edition-field-weekday-chips">${chipsHtml}</div>`;
    } else if (field.type === "state") {
      // Suggestions (pas une liste fermée : certaines intégrations ont des
      // états custom) des états connus pour le domaine de l'entité du bloc —
      // datalist plutôt que select, même logique que le champ "entity".
      const listId = `edition-states-${field.key.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const entityId = this._editionGetFieldValue(block, "entity_id");
      const domain = String(Array.isArray(entityId) ? entityId[0] : entityId || "").split(".")[0];
      const stateOptions = getDomainStates(domain)
        .map((s) => `<option value="${escapeHtml(s)}"></option>`)
        .join("");
      inputHtml = `
        <input type="text" class="detail-input" list="${listId}" data-field-key="${keyAttr}" data-field-type="text" value="${escapeHtml(String(display))}" placeholder="${escapeHtml(field.placeholder || "")}" />
        <datalist id="${listId}">${stateOptions}</datalist>
      `;
    } else {
      inputHtml = `<input type="text" class="detail-input" data-field-key="${keyAttr}" data-field-type="text" value="${escapeHtml(String(display))}" placeholder="${escapeHtml(field.placeholder || "")}" />`;
    }
    return `
      <div class="detail-field edition-field">
        <span class="detail-label">${escapeHtml(field.label)}</span>
        ${inputHtml}
      </div>
    `;
  }

  // Repli générique (bloc hors schéma statique, cf. getBlockFields "raw") :
  // une ligne éditable par clé déjà présente dans le bloc, plus un mini
  // formulaire pour en ajouter une nouvelle. Jamais de bloc non éditable.
  _renderEditionRawFields(block, keys) {
    const rows = keys
      .map((key) => {
        const raw = block[key];
        const display = typeof raw === "object" && raw !== null ? JSON.stringify(raw) : String(raw ?? "");
        return `
          <div class="detail-field edition-field">
            <span class="detail-label">${escapeHtml(key)}</span>
            <input type="text" class="detail-input" data-field-key="${escapeHtml(key)}" data-field-type="raw" value="${escapeHtml(display)}" />
          </div>
        `;
      })
      .join("");
    return `
      <div class="edition-field-raw-list">${rows}</div>
      <div class="edition-field-raw-add">
        <input type="text" class="detail-input edition-raw-add-key" placeholder="Nouvelle clé" />
        <input type="text" class="detail-input edition-raw-add-value" placeholder="Valeur" />
        <button class="icon-button" data-action="add-raw-field" title="Ajouter la clé">
          ${this._icon(ICON_PLUS, 16)}
        </button>
      </div>
    `;
  }

  // Panneau droit "paramètres du bloc" (issue #101) : état vide inchangé
  // tant qu'aucun bloc n'est sélectionné, formulaire dynamique (schéma réel
  // ou repli clé→valeur générique) sinon. Écriture 100% en mémoire dans
  // this._editionYaml.config. Bouton "Supprimer le bloc" fonctionnel
  // (issue #102), réutilise _editionDeleteBlock() tel quel (menu kebab,
  // #105) — pas de popup de confirmation, même décision explicite.
  _renderEditionSettingsPanel() {
    const block = this._editionGetSelectedBlock();
    if (!this._selectedBlock || !block) {
      return `
        <div class="edition-settings-panel">
          <div class="edition-settings-empty">
            ${this._icon(ICON_SETTINGS, 28)}
            <p>Sélectionnez un bloc pour afficher ses paramètres.</p>
          </div>
        </div>
      `;
    }
    const { category, index } = this._selectedBlock;
    const hass = this._hass;
    const conditionContext = category === "condition" ? { triggers: pickList(this._editionYaml.config, "trigger", "triggers") } : undefined;
    const described = this._editionDescribeBlock(category, block, hass, conditionContext);
    const fieldsInfo = getBlockFields(category, block);
    // Champ "id" (ajustement post-review) : uniquement pour les triggers —
    // vérifié via la doc officielle HA (find-docs/Context7) : `id` n'est un
    // champ documenté QUE pour les triggers (référencé ensuite par
    // `condition: trigger`), pas pour les conditions/actions, qui utilisent
    // `alias` pour l'identification. L'afficher pour condition/action serait
    // trompeur (clé inconnue, silencieusement ignorée par HA, aucun effet).
    // Réutilise _renderEditionFieldRow() comme n'importe quel champ texte :
    // écriture déjà générique via l'écouteur "change" existant
    // (data-field-key/data-field-type), aucun nouveau branchement requis.
    const idFieldHtml =
      category === "trigger" ? this._renderEditionFieldRow(block, { key: "id", label: "ID", type: "text", required: false, placeholder: "ex: t_0545" }) : "";
    const idSeparatorHtml = idFieldHtml ? `<div class="edition-settings-separator"></div>` : "";
    const bodyHtml =
      fieldsInfo.kind === "schema"
        ? fieldsInfo.fields.map((field) => this._renderEditionFieldRow(block, field)).join("")
        : this._renderEditionRawFields(block, fieldsInfo.keys);
    const yamlPreview = this._stringifyYaml(block)
      .map((line) => escapeHtml(line || " "))
      .join("\n");
    return `
      <div class="edition-settings-panel">
        <div class="edition-settings-header">
          <span class="edition-settings-icon edition-block-icon-${category}">${this._icon(described.icon, 15)}</span>
          <div class="edition-settings-header-text">
            <span class="edition-settings-title">${escapeHtml(described.title)}</span>
            <span class="edition-settings-subtitle">${escapeHtml(EDITION_CATEGORY_LABELS[category])} · bloc ${index + 1}</span>
          </div>
          <button class="icon-button edition-settings-close" data-action="close-settings" title="Fermer">
            ${this._icon(ICON_X, 16)}
          </button>
        </div>
        <div class="scroll-area edition-settings-body">
          ${idFieldHtml}
          ${idSeparatorHtml}
          ${bodyHtml}
          <div class="edition-settings-separator"></div>
          <div class="edition-field-yaml-preview">
            <span class="detail-label">YAML généré</span>
            <pre class="edition-yaml-preview-block">${yamlPreview}</pre>
          </div>
        </div>
        <div class="edition-settings-footer">
          <button class="edition-settings-delete-btn" data-action="delete-block" title="Supprimer le bloc">
            ${this._icon(ICON_TRASH, 14)}<span>Supprimer le bloc</span>
          </button>
        </div>
      </div>
    `;
  }

  // Popup Aide de la page Édition — contenu à venir, même pattern que les
  // blocs "Bientôt disponible" du reste du panel (voir issue #83 pour la
  // rédaction du vrai contenu, pas propre à ce popup).
  _renderEditionHelpPopup() {
    return `
      <div class="popup-overlay" data-popup="edition-help">
        <div class="popup-card popup-edition-help">
          <div class="popup-header">
            <div class="popup-header-title"><span>Aide</span></div>
            <button class="popup-close" data-action="close-edition-help" title="Fermer">${this._icon(ICON_X, 14)}</button>
          </div>
          <div class="popup-body">
            <p class="popup-text-secondary">Contenu à venir.</p>
          </div>
        </div>
      </div>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          position: relative;
          height: 100vh;
          overflow: hidden;
          background: var(--primary-background-color, #fafafa);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
          /* Surface élevée (carte/ligne) dérivée de la couleur de page plutôt
             que de --card-background-color seul : sur certains thèmes HA
             custom, --card-background-color est quasi identique à
             --primary-background-color et ne produit aucun contraste
             visible. On garde la teinte du thème (color-mix sur la couleur
             de page) tout en garantissant un écart de clarté, sur le modèle
             iOS listes groupées — plus clair en mode clair, plus sombre en
             mode sombre. Voir .ap-dark ci-dessous pour la variante sombre.
             Écart volontairement marqué (40%/50%, pas 6%/12%, 15%/25% ni
             28%/38%) : les versions précédentes ont toutes été jugées trop
             discrètes. */
          --ap-surface: color-mix(in srgb, var(--primary-background-color, #fafafa) 60%, white 40%);
          /* Fond des lignes désactivées : gris neutre figé (pas dérivé de
             --secondary-background-color) — sur un thème custom très
             coloré, cette variable hérite de la teinte du thème et un état
             "désactivé" qui garde cette teinte se lit mal comme du gris. */
          --ap-off-surface: #e4e4e4;
          /* Fond des boutons (Regrouper/Trier/badges état/Déverrouiller/
             Réglages/etc.) : figé blanc/gris foncé, jamais dérivé de
             --card-background-color ni --primary-color du thème actif — sur
             un thème custom, ces variables peuvent rendre les boutons
             invisibles ou disgracieux. Couleurs d'accent également figées
             (pas var(--primary-color)) : #03a9f4 (bleu, état "activé"/action
             principale, cohérent avec .state-toggle.on) et #8e8e93 (gris,
             état "désactivé", cohérent avec le fond off de .state-toggle). */
          --ap-btn-bg: #ffffff;
          --ap-accent-blue: #03a9f4;
          --ap-accent-grey: #8e8e93;
          /* Bloc ajouté/modifié non enregistré (vue Liste) — violet dédié,
             distinct des 3 couleurs de catégorie (ambre/bleu/vert) pour ne
             pas créer d'ambiguïté avec le badge Déclencheur. Prototypé dans
             le .pen (frame "Carte Bloc — ajouté/modifié (exemple)"). Figé
             comme les accents ci-dessus, pas de variante sombre dédiée (même
             logique que --ap-accent-blue/--ap-accent-grey). */
          --ap-accent-purple: #8e24aa;
          /* Couleurs de catégorie de la vue Édition Liste (#5), reprises du
             .pen (badges/icônes Déclencheur/Condition/Action) — figées comme
             les accents ci-dessus, avec une variante sombre dédiée (voir
             :host(.ap-dark) juste en dessous) pour rester lisibles, contrairement
             à un premier essai qui les avait oubliées. */
          --ap-category-trigger-bg: #fff8e1;
          --ap-category-trigger-fg: #ef6c00;
          --ap-category-condition-bg: #e3f2fd;
          --ap-category-condition-fg: #1565c0;
          --ap-category-action-bg: #e8f5e9;
          --ap-category-action-fg: #2e7d32;
          /* Surlignage des correspondances de recherche dans la vue Code
             (issue #112) — jaune neutre, volontairement distinct des 3
             couleurs de catégorie ci-dessus pour ne créer aucune ambiguïté
             avec le surlignage de bloc de la sidebar "Aller à". */
          --ap-search-match-bg: #fff9c4;
        }
        :host(.ap-dark) {
          --ap-surface: color-mix(in srgb, var(--primary-background-color, #111111) 50%, black 50%);
          --ap-off-surface: #3a3a3a;
          --ap-btn-bg: #2c2c2e;
          --ap-category-trigger-bg: #4d3800;
          --ap-category-trigger-fg: #ffb74d;
          --ap-category-condition-bg: #0d3868;
          --ap-category-condition-fg: #64b5f6;
          --ap-category-action-bg: #1b4d1e;
          --ap-category-action-fg: #81c784;
          --ap-search-match-bg: #5c4a00;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          height: 64px;
          padding: 0 16px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          color: var(--secondary-text-color, #666);
        }
        .icon-button svg {
          width: 22px;
          height: 22px;
        }
        .icon-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wordmark {
          display: block;
          flex-shrink: 0;
          color: var(--primary-text-color, #212121);
        }
        .version-badge {
          font-family: monospace;
          font-size: 11px;
          color: var(--secondary-text-color, #666);
          background: var(--secondary-background-color, #f1f3f4);
          padding: 2px 8px;
          border-radius: 10px;
          text-decoration: none;
          cursor: pointer;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .edition-toolbar {
          gap: 12px;
        }
        .edition-actions-separator {
          width: 1px;
          height: 22px;
          margin: 0 6px;
          background: var(--divider-color, #e0e0e0);
          flex-shrink: 0;
        }
        .edition-lock-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid var(--ap-accent-blue, #03a9f4);
          background: var(--ap-btn-bg, #fff);
          color: var(--ap-accent-blue, #03a9f4);
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .edition-lock-btn:disabled {
          opacity: 0.6;
          pointer-events: none;
        }
        .edition-title {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          max-width: 360px;
          padding: 0 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--ap-btn-bg, #fff);
          color: var(--primary-text-color, #212121);
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .edition-title span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .edition-title svg {
          flex-shrink: 0;
          color: var(--secondary-text-color, #666);
        }
        .edition-view-selector {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: var(--secondary-background-color, #f1f3f4);
          border-radius: 9px;
          flex-shrink: 0;
        }
        .edition-segment {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
          cursor: pointer;
        }
        .edition-segment.active {
          background: var(--ap-btn-bg, #fff);
          color: var(--primary-text-color, #212121);
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.13);
        }
        .edition-segment.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .edition-readonly-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          padding: 10px 20px;
          background: var(--secondary-background-color, #f1f3f4);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          color: var(--secondary-text-color, #666);
          font-size: 13px;
        }
        .edition-readonly-banner-dirty {
          background: color-mix(in srgb, var(--warning-color, #ff9800) 12%, var(--secondary-background-color, #f1f3f4));
          color: var(--warning-color, #ff9800);
        }
        .edition-scroll-area {
          padding: 20px;
          flex: 1;
          min-width: 0;
        }
        .edition-status-text {
          margin: 0;
          padding: 24px;
          text-align: center;
          color: var(--secondary-text-color, #666);
          font-size: 13px;
        }
        .edition-status-error {
          color: var(--error-color, #c62828);
        }
        .edition-editor-card {
          display: flex;
          min-height: 100%;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .edition-gutter {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          /* Padding gauche retiré du conteneur et reporté sur
             .edition-line-number (issue #112) : le trait vertical (border-
             left) doit s'appuyer sur le vrai bord gauche de la gouttière,
             pas apparaître en retrait à l'intérieur du padding — sinon un
             espace neutre reste visible avant le trait (retour utilisateur,
             comparaison directe avec la carte "modifié" du .pen où le trait
             est flush contre le bord). */
          padding: 16px 10px 16px 0;
          background: var(--secondary-background-color, #f1f3f4);
          border-right: 1px solid var(--divider-color, #e0e0e0);
          text-align: right;
        }
        .edition-line-number {
          font-family: monospace;
          font-size: 13px;
          line-height: 1.6;
          color: var(--secondary-text-color, #666);
          padding-left: 10px;
          /* Trait vertical de la section active de la sidebar "Aller à"
             (issue #112, retour utilisateur) — à GAUCHE des numéros, flush
             contre le bord gauche de la gouttière (voir padding-left ci-
             dessus, reporté du conteneur vers ce span pour que le border-left
             s'appuie sur le vrai bord, pas sur un padding interne). Bordure
             transparente en permanence pour éviter un décalage horizontal à
             l'activation ; .edition-line-number est un
             flex-item étiré (stretch par défaut) sur toute la largeur de la
             gouttière malgré text-align:right, donc ce border-left reste
             fixe à gauche quel que soit le nombre de chiffres du numéro. */
          border-left: 3px solid transparent;
          transition: color 0.2s ease, border-color 0.2s ease;
        }
        .edition-code {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          padding: 16px;
          overflow-x: auto;
        }
        .edition-line-text {
          font-family: monospace;
          font-size: 13px;
          line-height: 1.6;
          color: var(--primary-text-color, #212121);
          white-space: pre;
          transition: color 0.2s ease, background-color 0.2s ease;
        }
        /* Section active de la sidebar "Aller à" (issue #112) : sélection
           PERSISTANTE (retour utilisateur explicite, pas l'état transitoire
           du plan d'origine) — fond teinté UNIQUEMENT sur la colonne du code
           (retour utilisateur), la gouttière ne porte que le trait vertical
           de 3px, flush à son bord gauche, sans fond. */
        .edition-gutter .edition-line-highlight.edition-line-highlight-trigger {
          border-left-color: var(--ap-category-trigger-fg);
        }
        .edition-gutter .edition-line-highlight.edition-line-highlight-condition {
          border-left-color: var(--ap-category-condition-fg);
        }
        .edition-gutter .edition-line-highlight.edition-line-highlight-action {
          border-left-color: var(--ap-category-action-fg);
        }
        .edition-code .edition-line-highlight.edition-line-highlight-trigger {
          background: var(--ap-category-trigger-bg);
        }
        .edition-code .edition-line-highlight.edition-line-highlight-condition {
          background: var(--ap-category-condition-bg);
        }
        .edition-code .edition-line-highlight.edition-line-highlight-action {
          background: var(--ap-category-action-bg);
        }
        /* Correspondances de la recherche YAML (issue #112) — indépendant du
           surlignage de catégorie ci-dessus, une ligne peut cumuler les deux
           (voir _renderEditionCodeLines). Spécificité de sélecteur portée à
           3 classes (comme les règles de catégorie ci-dessus, même propriété
           background) pour rester visible même sur une ligne déjà en fond
           catégorie — sans ça le fond catégorie l'emporte systématiquement
           et masque le surlignage recherche, piège relevé en review. */
        .edition-code .edition-line-text.edition-line-search-match {
          background: var(--ap-search-match-bg);
        }
        /* Vue Code (#87) — Sidebar "Aller à" + recherche (issue #112) : mêmes
           largeur/padding que .edition-palette de la vue Liste (cohérence
           visuelle entre les 2 onglets). Dimensions et couleurs fidèles au
           .pen (frame U3del2, sidebar VIKlQ). */
        .edition-code-body {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .edition-code-sidebar {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 300px;
          padding: 16px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-right: 1px solid var(--divider-color, #e0e0e0);
          overflow-y: auto;
        }
        .edition-code-sidebar-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--secondary-text-color, #666);
          padding: 4px 2px 4px;
        }
        .edition-goto-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 44px;
          padding: 0 16px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 10px;
          background: var(--ap-btn-bg, #fff);
          color: var(--secondary-text-color, #666);
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .edition-goto-btn:hover:not(:disabled) {
          background: var(--secondary-background-color, #f1f3f4);
          color: var(--primary-text-color, #212121);
        }
        .edition-goto-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        /* État actif PERSISTANT (issue #112, retour utilisateur) — reste
           coloré tant que l'utilisateur n'a pas rediqué dessus, contrairement
           à un état "pressé" transitoire. */
        .edition-goto-btn-trigger.edition-goto-btn-active {
          background: var(--ap-category-trigger-bg);
          border-color: var(--ap-category-trigger-fg);
          color: var(--ap-category-trigger-fg);
        }
        .edition-goto-btn-condition.edition-goto-btn-active {
          background: var(--ap-category-condition-bg);
          border-color: var(--ap-category-condition-fg);
          color: var(--ap-category-condition-fg);
        }
        .edition-goto-btn-action.edition-goto-btn-active {
          background: var(--ap-category-action-bg);
          border-color: var(--ap-category-action-fg);
          color: var(--ap-category-action-fg);
        }
        /* Vue Liste (#5) — Sidebar Palette, Zone Centrale et Panneau
           Paramètres tous fonctionnels en mémoire (#101/#102), fidèles aux
           dimensions et à la structure du .pen (« Edition automatisation -
           liste ») : palette 300px, panneau paramètres 340px. */
        .edition-liste-body {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .edition-palette {
          flex-shrink: 0;
        }
        .edition-settings-panel {
          flex-shrink: 0;
        }
        .edition-palette {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 300px;
          padding: 16px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-right: 1px solid var(--divider-color, #e0e0e0);
          overflow-y: auto;
        }
        /* Conteneur des sections affichées sous le switcher (issue #102,
           ajustement post-review) — display:flex/gap explicite : en mode
           recherche "toutes catégories" (_renderEditionPaletteSections()),
           plusieurs .edition-palette-section peuvent être des enfants
           directs et se retrouvaient collées les unes aux autres (bug
           visuel remonté par l'utilisateur, aucun gap sans cette règle). */
        .edition-palette-sections {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .edition-palette-search {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--primary-background-color, #fafafa);
          color: var(--secondary-text-color, #666);
        }
        .edition-palette-search input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
        }
        /* Switcher de catégories (issue #102, ajustement post-review) —
           mêmes couleurs/rayon/ombre que .edition-segment (toolbar Édition,
           switch Liste/Graphe/Code), réutilisées à l'identique. Seule
           différence : icône empilée au-dessus du label (pas côte à côte)
           pour tenir sur 1/3 des 300px de la palette sans débordement. */
        .edition-palette-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px;
          background: var(--secondary-background-color, #f1f3f4);
          border-radius: 9px;
          flex-shrink: 0;
        }
        .edition-palette-tabs.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .edition-palette-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 6px 4px;
          border-radius: 6px;
          font-size: 11px;
          color: var(--secondary-text-color, #666);
          cursor: pointer;
        }
        .edition-palette-tab.active {
          background: var(--ap-btn-bg, #fff);
          color: var(--primary-text-color, #212121);
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.13);
        }
        .edition-palette-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .edition-palette-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--secondary-text-color, #666);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.6px;
        }
        .edition-palette-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .edition-palette-item {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 36px;
          padding: 0 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--primary-background-color, #fafafa);
          color: var(--secondary-text-color, #666);
          font-size: 13px;
          cursor: pointer;
        }
        .edition-palette-item:hover {
          background: var(--ap-off-surface, var(--secondary-background-color, #f0f0f0));
          border-color: var(--ap-accent-blue, var(--primary-color, #4f8eff));
        }
        .edition-palette-item:active {
          background: var(--ap-surface, var(--card-background-color, #fff));
        }
        .edition-palette-item span {
          flex: 1;
          color: var(--primary-text-color, #212121);
        }
        .edition-palette-empty {
          margin: 0;
          padding: 12px 4px;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
          text-align: center;
        }
        .edition-palette-footer {
          margin-top: auto;
          padding-top: 8px;
          flex-shrink: 0;
          font-size: 11px;
          text-align: center;
          color: var(--secondary-text-color, #666);
        }
        .edition-settings-panel {
          display: flex;
          flex-direction: column;
          width: 340px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-left: 1px solid var(--divider-color, #e0e0e0);
        }
        .edition-settings-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
          color: var(--secondary-text-color, #666);
        }
        .edition-settings-empty svg {
          opacity: 0.4;
        }
        .edition-settings-empty p {
          margin: 0;
          font-size: 13px;
        }
        /* Panneau Paramètres rempli (issue #101), fidèle au .pen (nœud
           iA6tt) — variables déjà figées via DESIGN-COLORS.md (--ap-btn-bg
           pour les champs, --ap-surface pour le fond du panneau déjà posé
           plus haut). */
        .edition-settings-header {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          height: 56px;
          padding: 0 16px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .edition-settings-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        .edition-settings-header-text {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          gap: 2px;
        }
        .edition-settings-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .edition-settings-subtitle {
          font-size: 11px;
          color: var(--secondary-text-color, #666);
        }
        .edition-settings-close {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        .edition-settings-close:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .edition-settings-close svg {
          width: 16px;
          height: 16px;
        }
        .edition-settings-body {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 16px;
        }
        .edition-field-textarea {
          height: auto;
          min-height: 72px;
          padding: 8px 10px;
          font-family: var(--code-font-family, monospace);
          resize: vertical;
        }
        /* Champ "weekday" (issue #102, ajustement post-review, ex.
           trigger:time) — 7 chips égales, même logique de couleur active
           que .status-chip.active[data-value="on"] (--ap-accent-blue). */
        .edition-field-weekday-chips {
          display: flex;
          gap: 4px;
        }
        .edition-field-weekday-chip {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 24px;
          padding: 0;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--ap-btn-bg, #fff);
          color: var(--secondary-text-color, #666);
          font-family: inherit;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
        }
        .edition-field-weekday-chip:hover {
          background: var(--ap-off-surface, var(--secondary-background-color, #f0f0f0));
        }
        .edition-field-weekday-chip.active {
          background: var(--ap-accent-blue, #03a9f4);
          border-color: var(--ap-accent-blue, #03a9f4);
          color: #fff;
          font-weight: 700;
        }
        .edition-settings-separator {
          flex-shrink: 0;
          height: 1px;
          background: var(--divider-color, #e0e0e0);
        }
        .edition-field-yaml-preview {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .edition-yaml-preview-block {
          margin: 0;
          background: var(--ap-btn-bg, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 10px;
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
          line-height: 1.5;
          color: var(--secondary-text-color, #666);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .edition-field-raw-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .edition-field-raw-add {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .edition-raw-add-key {
          flex: 0 0 40%;
        }
        .edition-raw-add-value {
          flex: 1;
        }
        .edition-field-raw-add .icon-button {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
        }
        .edition-field-raw-add .icon-button svg {
          width: 16px;
          height: 16px;
        }
        .edition-settings-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          height: 56px;
          padding: 0 16px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
        .edition-settings-delete-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border: 1px solid var(--error-color, #c62828);
          border-radius: 8px;
          background: var(--ap-btn-bg, #fff);
          color: var(--secondary-text-color, #666);
          font-family: inherit;
          font-size: 13px;
        }
        .edition-liste-central {
          flex: 1;
          min-width: 0;
          padding: 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          background: var(--primary-background-color, #fafafa);
        }
        .edition-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .edition-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        /* Badge coloré par catégorie, comme le .pen — couleurs figées avec
           variante sombre dédiée (voir --ap-category-* sur :host), pas de
           dérivation du thème actif. */
        .edition-group-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          padding: 4px 9px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }
        .edition-group-badge-trigger {
          background: var(--ap-category-trigger-bg);
          color: var(--ap-category-trigger-fg);
        }
        .edition-group-badge-condition {
          background: var(--ap-category-condition-bg);
          color: var(--ap-category-condition-fg);
        }
        .edition-group-badge-action {
          background: var(--ap-category-action-bg);
          color: var(--ap-category-action-fg);
        }
        .edition-group-divider {
          flex: 1;
          height: 1px;
          background: var(--divider-color, #e0e0e0);
        }
        .edition-group-divider.modified {
          background: var(--ap-accent-purple, #8e24aa);
        }
        .edition-group-cards {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .edition-group-empty {
          margin: 0;
          padding: 12px 14px;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
        }
        .edition-block-card {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 64px;
          padding: 0 14px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 10px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          cursor: pointer;
        }
        /* Sélection du bloc édité (issue #101) — bordure/fond figés en
           --ap-accent-blue, jamais dérivés du thème (cohérent avec les
           autres accents interactifs, voir DESIGN-COLORS.md §2). */
        .edition-block-card.selected {
          border-color: var(--ap-accent-blue, #03a9f4);
          background: color-mix(in srgb, var(--ap-accent-blue, #03a9f4) 8%, var(--ap-surface, var(--card-background-color, #fff)));
        }
        /* Bloc modifié non enregistré (issue #101, retour utilisateur) :
           bordure + liseré gauche plus épais en --ap-accent-purple, ordre
           des règles après .selected pour que la bordure violette prime si
           le bloc modifié est aussi celui actuellement sélectionné (le fond
           teinté bleu de .selected reste visible, lui, comme indicateur de
           sélection active). */
        .edition-block-card.modified {
          border-color: var(--ap-accent-purple, #8e24aa);
          border-left-width: 4px;
        }
        /* Bloc désactivé (clé HA enabled:false, issue #105) — même
           traitement que .automation-row-off (Dashboard) : fond gris figé,
           pas d'assombrissement du texte/de l'icône (cohérent avec l'écran
           déjà validé côté Dashboard). */
        .edition-block-card.disabled {
          background: var(--ap-off-surface, #e4e4e4);
        }
        .edition-block-handle {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          color: var(--secondary-text-color, #666);
          cursor: grab;
          touch-action: none;
        }
        .edition-block-handle:active {
          cursor: grabbing;
        }
        /* Glisser-déposer (issue #110) — la carte source suit librement le
           pointeur via transform (posée en JS pendant le geste, voir
           _attachListeners()), élevée au-dessus des autres pour rester
           lisible pendant qu'elles se décalent en dessous/au-dessus d'elle. */
        .edition-block-card.dragging {
          position: relative;
          z-index: 5;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
          cursor: grabbing;
        }
        .edition-block-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }
        .edition-block-icon-trigger {
          background: var(--ap-category-trigger-bg);
          color: var(--ap-category-trigger-fg);
        }
        .edition-block-icon-condition {
          background: var(--ap-category-condition-bg);
          color: var(--ap-category-condition-fg);
        }
        .edition-block-icon-action {
          background: var(--ap-category-action-bg);
          color: var(--ap-category-action-fg);
        }
        .edition-block-text {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          gap: 3px;
        }
        .edition-block-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
        }
        .edition-block-summary {
          font-size: 12px;
          color: var(--secondary-text-color, #666);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .edition-block-kebab {
          flex-shrink: 0;
        }
        .edition-block-card .state-toggle {
          flex-shrink: 0;
        }
        /* .options-wrap porte un margin-left pensé pour la ligne
           Dashboard (pas de gap sur son conteneur) — neutralisé ici, la
           carte espace déjà ses enfants via son propre gap:12px. */
        .edition-block-card .options-wrap {
          margin-left: 0;
          flex-shrink: 0;
        }
        .edition-group-add {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 38px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 10px;
          background: transparent;
          color: var(--secondary-text-color, #666);
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .edition-group-add:hover {
          background: var(--ap-off-surface, var(--secondary-background-color, #f0f0f0));
        }
        .popup-card.popup-edition-help {
          max-width: 440px;
        }
        .toolbar {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 12px;
          height: 48px;
          padding: 0 16px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .toolbar-separator {
          width: 1px;
          height: 20px;
          background: var(--divider-color, #e0e0e0);
          flex-shrink: 0;
        }
        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 240px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--primary-background-color, #fafafa);
          color: var(--secondary-text-color, #666);
        }
        .search-wrap input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
        }
        .regroup-wrap {
          position: relative;
        }
        .regroup-btn,
        .sort-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--ap-btn-bg, #fff);
          color: var(--secondary-text-color, #666);
          font-size: 13px;
          cursor: pointer;
        }
        .dropdown-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9;
        }
        .dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          width: 200px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          z-index: 10;
        }
        .dropdown-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
          cursor: pointer;
        }
        .dropdown-option:hover {
          background: var(--primary-background-color, #fafafa);
        }
        .dropdown-option.selected {
          background: var(--primary-background-color, #fafafa);
          font-weight: 600;
          color: var(--ap-accent-blue, #03a9f4);
        }
        .chips-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          flex-shrink: 0;
          gap: 6px;
          padding: 10px 16px;
          background: var(--card-background-color, #fff);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .status-filters {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .status-filters-separator {
          width: 1px;
          height: 20px;
          background: var(--divider-color, #e0e0e0);
        }
        .status-chip {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          height: 32px;
          border: 1px solid var(--ap-accent-blue, #03a9f4);
          border-radius: 8px;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 400;
          font-family: inherit;
          cursor: pointer;
          background: var(--ap-btn-bg, #fff);
          color: var(--ap-accent-blue, #03a9f4);
        }
        /* États sélectionnés volontairement distincts et figés (pas dérivés
           du thème) : "Toutes" neutre sombre, "Activées" reprend la couleur
           du toggle activé (--ap-accent-blue, cohérence avec .state-toggle.on
           plutôt qu'une couleur inédite), "Désactivées" reprend le même gris
           que .state-toggle à l'état off (--ap-accent-grey). */
        .status-chip.active {
          background: #212121;
          border-color: #212121;
          color: #fff;
          font-weight: 700;
        }
        .status-chip.active[data-value="on"] {
          background: var(--ap-accent-blue, #03a9f4);
          border-color: var(--ap-accent-blue, #03a9f4);
        }
        .status-chip.active[data-value="off"] {
          background: var(--ap-accent-grey, #8e8e93);
          border-color: var(--ap-accent-grey, #8e8e93);
        }
        /* "Désactivées" au repos : liseré + texte gris (comme le futur fond
           une fois sélectionné), pas le bleu générique des 2 autres badges. */
        .status-chip[data-value="off"]:not(.active) {
          border-color: var(--ap-accent-grey, #8e8e93);
          color: var(--ap-accent-grey, #8e8e93);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          box-sizing: border-box;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 9px;
          border-radius: 12px;
          border: none;
          font-family: inherit;
          flex-shrink: 0;
        }
        .chip.chip-clickable {
          cursor: pointer;
        }
        .chip.active {
          font-weight: 700;
        }
        .chip-icon {
          --mdc-icon-size: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 10px;
          height: 10px;
          color: inherit;
        }
        .chip-reset {
          background: var(--secondary-background-color, #f1f3f4);
          color: var(--secondary-text-color, #666);
          cursor: pointer;
          padding-left: 10px;
          padding-right: 10px;
        }
        .chip-reset:not(:disabled):hover {
          background: var(--divider-color, #e0e0e0);
        }
        .chip-reset.active {
          background: #212121;
          color: #fff;
          cursor: default;
        }
        .scroll-area {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .list-container {
          /* padding-bottom élargi pour ne pas laisser le FAB "+" (56px,
          ancré à 32px du bas, voir .fab) recouvrir l'état/menu Options de
          la dernière ligne du Dashboard une fois scrollé en bas */
          padding: 16px 16px 96px;
        }
        .empty-state {
          margin: 0;
          padding: 24px 0;
          text-align: center;
          color: var(--secondary-text-color, #666);
        }
        .automation-group {
          margin-bottom: 20px;
        }
        .automation-group-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
          margin: 0 0 8px;
        }
        .group-count {
          font-weight: 400;
          color: var(--secondary-text-color, #666);
        }
        .automation-table {
          background: var(--ap-surface, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .automation-row {
          display: grid;
          grid-template-columns: minmax(180px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(80px, 1fr) 100px;
          gap: 12px;
          align-items: center;
          padding: 16px;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          cursor: pointer;
        }
        .automation-row:last-child {
          border-bottom: none;
        }
        .automation-row-off {
          background: var(--ap-off-surface, #e4e4e4);
        }
        .automation-row-header {
          cursor: default;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--secondary-text-color, #666);
          background: var(--primary-background-color, #fafafa);
        }
        .col-name {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
        }
        .row-icon {
          --mdc-icon-size: 18px;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          color: var(--secondary-text-color, #666);
        }
        .row-name-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .row-name-text {
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 14px;
          font-weight: 700;
        }
        .row-entity-id {
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-family: var(--code-font-family, monospace);
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }
        .col-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          min-width: 0;
        }
        .col-category,
        .col-area {
          min-width: 0;
        }
        .meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
          max-width: 100%;
        }
        .meta-badge span {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .meta-empty {
          color: var(--secondary-text-color, #666);
          opacity: 0.5;
        }
        .col-state {
          display: flex;
          justify-content: flex-start;
        }
        .state-toggle {
          display: inline-flex;
          align-items: center;
          box-sizing: border-box;
          width: 40px;
          height: 24px;
          border-radius: 12px;
          padding: 2px;
          /* Gris figé (pas var(--divider-color), théme-dépendant) — même
             valeur que .status-chip.active[data-value="off"]. */
          background: var(--ap-accent-grey, #8e8e93);
          cursor: pointer;
        }
        .state-toggle.pending {
          opacity: 0.5;
          pointer-events: none;
        }
        .state-toggle.on {
          background: var(--ap-accent-blue, #03a9f4);
          justify-content: flex-end;
        }
        .state-toggle-knob {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        .options-wrap {
          position: relative;
          margin-left: 8px;
        }
        .options-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: var(--secondary-text-color, #727272);
          cursor: pointer;
        }
        .options-btn:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .options-menu {
          /* position: fixed calculée en JS (_positionOptionsMenu) — top/left
             posés dynamiquement, échappe ainsi aux overflow:hidden/auto de
             .automation-table/.scroll-area qui le rognaient selon la ligne
             (voir issue scroll/menu kebab). */
          position: fixed;
          min-width: 220px;
          max-height: calc(100vh - 16px);
          overflow-y: auto;
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          padding: 4px 0;
          z-index: 20;
        }
        .options-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          font-size: 14px;
          color: var(--primary-text-color, #212121);
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          box-sizing: border-box;
        }
        .options-menu-item:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .options-menu-item.disabled {
          opacity: 0.4;
          pointer-events: none;
        }
        .options-menu-item ha-icon {
          --mdc-icon-size: 20px;
          color: var(--secondary-text-color, #727272);
        }
        .options-menu-item-danger {
          color: var(--error-color, #c62828);
        }
        .options-menu-item-danger ha-icon {
          color: var(--error-color, #c62828);
        }
        .options-menu-separator {
          height: 1px;
          margin: 4px 0;
          background: var(--divider-color, #e0e0e0);
        }
        .popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
          box-sizing: border-box;
        }
        .popup-card {
          background: var(--ap-surface, var(--card-background-color, #fff));
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.13);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          width: 100%;
        }
        .popup-card.popup-delete {
          max-width: 520px;
        }
        .popup-card.popup-detail {
          max-width: 580px;
        }
        .popup-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
        }
        .popup-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
          line-height: 1.3;
        }
        .popup-header-title.danger {
          color: var(--error-color, #c62828);
        }
        .popup-header-title.danger span {
          color: var(--primary-text-color, #212121);
        }
        .popup-close {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--ap-btn-bg, #fff);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--secondary-text-color, #666);
          flex-shrink: 0;
        }
        .popup-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
        }
        .popup-body p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--primary-text-color, #212121);
        }
        .popup-text-secondary {
          color: var(--secondary-text-color, #666) !important;
        }
        .popup-footer {
          padding: 12px 20px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .popup-btn {
          height: 34px;
          padding: 0 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
        }
        .popup-btn-secondary {
          background: var(--ap-btn-bg, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          color: var(--secondary-text-color, #666);
        }
        .popup-btn-primary {
          background: var(--ap-accent-blue, #03a9f4);
          border: none;
          color: #fff;
          font-weight: 700;
        }
        .popup-btn-danger {
          background: var(--error-color, #c62828);
          border: none;
          color: #fff;
          font-weight: 700;
        }
        .popup-btn:disabled {
          opacity: 0.6;
          pointer-events: none;
        }
        .detail-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .detail-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--secondary-text-color, #666);
          line-height: 1.2;
        }
        .detail-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .detail-id {
          font-size: 10px;
          font-weight: 400;
          color: var(--secondary-text-color, #666);
        }
        .detail-input,
        .detail-select {
          height: 36px;
          background: var(--ap-btn-bg, #fff);
          border-radius: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          padding: 0 10px;
          font-size: 13px;
          color: var(--primary-text-color, #212121);
          box-sizing: border-box;
          width: 100%;
          font-family: inherit;
        }
        .detail-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .detail-name-row ha-icon,
        .detail-name-row svg {
          color: var(--secondary-text-color, #666);
          flex-shrink: 0;
        }
        .detail-icon-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .detail-icon-preview {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: var(--divider-color, #f1f3f4);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .detail-labels-zone {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          background: var(--ap-btn-bg, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 6px 8px;
          min-height: 36px;
          box-sizing: border-box;
        }
        .detail-label-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 10px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 500;
        }
        .detail-label-chip button {
          border: none;
          background: none;
          padding: 0;
          display: flex;
          cursor: pointer;
          color: inherit;
        }
        .detail-label-add {
          height: 26px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--ap-btn-bg, #fff);
          font-size: 11px;
          padding: 0 6px;
          color: var(--secondary-text-color, #666);
          font-family: inherit;
        }
        .detail-separator {
          height: 1px;
          background: var(--divider-color, #e0e0e0);
        }
        .detail-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .detail-toggle-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .detail-toggle-text .primary {
          font-size: 13px;
          color: var(--primary-text-color, #212121);
        }
        .detail-toggle-text .secondary {
          font-size: 11px;
          color: var(--secondary-text-color, #666);
        }
        .detail-entity-input {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          background: var(--ap-btn-bg, #fff);
          border-radius: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          padding: 0 10px;
          box-sizing: border-box;
        }
        .detail-entity-input input {
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
        }
        .detail-entity-input svg {
          color: var(--secondary-text-color, #666);
          flex-shrink: 0;
        }
        .detail-regenerate-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          height: 36px;
          background: var(--ap-btn-bg, #fff);
          border-radius: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          padding: 0 12px;
          font-size: 11px;
          font-family: inherit;
          color: var(--secondary-text-color, #666);
          cursor: pointer;
        }
        .detail-regenerate-btn svg {
          flex-shrink: 0;
        }
        .detail-entity-warning {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .detail-entity-warning svg {
          color: var(--warning-color, #ff9800);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .detail-entity-warning span {
          font-size: 11px;
          line-height: 1.35;
          color: var(--warning-color, #ff9800);
        }
        .fab {
          position: fixed;
          right: 32px;
          bottom: 32px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: var(--ap-accent-blue, #03a9f4);
          color: #fff;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }
        /* Le bouton "Nouvelle automatisation" de la toolbar (.new-automation-btn)
        couvre ce rôle sur desktop/tablette ; le FAB ne réapparaît qu'en
        largeur smartphone, où la toolbar est trop étroite pour l'accueillir
        lisiblement — voir claude-integration/RESPONSIVE-SMARTPHONE.md pour
        la piste générale du chantier responsive. */
        @media (max-width: 600px) {
          .fab {
            display: flex;
          }
        }
        .toast-container {
          position: fixed;
          top: 64px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          pointer-events: none;
        }
        .toast {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 420px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--error-color, #c62828);
          background: color-mix(in srgb, var(--card-background-color, #fff) 90%, transparent);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.13);
        }
        .toast svg {
          color: var(--error-color, #c62828);
          flex-shrink: 0;
        }
        .toast-message {
          flex: 1;
          font-size: 13px;
          line-height: 1.35;
          color: var(--error-color, #c62828);
        }
        .toast-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          color: var(--error-color, #c62828);
          flex-shrink: 0;
        }
        .settings-view {
          max-width: 760px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 16px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .settings-block {
          background: var(--ap-surface, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 12px;
          padding: 20px;
        }
        .settings-block h2 {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 700;
          color: var(--primary-text-color, #212121);
        }
        .settings-block > p {
          margin: 0;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
        }
        .settings-block-header {
          margin-bottom: 16px;
        }
        .settings-block-header > p {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
        }
        .settings-block-header-inline {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .settings-block-header-inline h2 {
          margin: 0;
        }
        .soon-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--secondary-background-color, #f1f3f4);
          color: var(--secondary-text-color, #666);
        }
        .storage-selector-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .storage-selector {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 2px;
          padding: 3px;
          border-radius: 9px;
          background: var(--secondary-background-color, #f1f3f4);
        }
        .storage-segment {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
        }
        .storage-segment.active {
          background: var(--ap-btn-bg, #fff);
          color: var(--primary-text-color, #212121);
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.13);
        }
        .storage-segment.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .storage-path-info {
          display: flex;
          flex: 1;
          min-width: 0;
          align-items: center;
          gap: 5px;
          margin: 0;
          font-size: 11px;
          color: var(--secondary-text-color, #666);
        }
        .storage-path-info span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .storage-path-info code {
          font-family: var(--code-font-family, monospace);
        }
        .settings-divider {
          height: 1px;
          margin: 16px 0;
          background: var(--divider-color, #e0e0e0);
        }
        .settings-action-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .settings-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 16px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--ap-btn-bg, #fff);
          color: var(--secondary-text-color, #666);
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
        }
        .settings-btn:hover:not(.disabled):not(:disabled) {
          border-color: var(--ap-accent-blue, #03a9f4);
          color: var(--primary-text-color, #212121);
        }
        .settings-btn.disabled,
        .settings-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .settings-block > .check-result {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin: 12px 0 0;
          font-size: 13px;
          color: var(--secondary-text-color, #666);
        }
        .check-result.check-ok {
          color: var(--success-color, #2e7d32);
        }
        .check-result.check-error {
          color: var(--error-color, #c62828);
        }
        .check-result svg {
          flex-shrink: 0;
          margin-top: 1px;
        }
        .settings-block > .yaml-check-timestamp {
          margin: 12px 0 8px;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }
        .yaml-check-results {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .yaml-check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }
        .yaml-check-row.check-ok {
          color: var(--success-color, #2e7d32);
        }
        .yaml-check-row.check-error {
          color: var(--error-color, #c62828);
        }
        .yaml-check-row svg {
          flex-shrink: 0;
        }
        .yaml-check-name {
          font-family: var(--code-font-family, monospace);
          color: inherit;
        }
        .yaml-check-status {
          margin-left: auto;
          text-align: right;
          flex-shrink: 0;
          color: inherit;
        }
        .about-version-row {
          margin-bottom: 12px;
        }
        .about-version-badge {
          display: inline-block;
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
          color: var(--secondary-text-color, #666);
          background: var(--secondary-background-color, #f1f3f4);
          padding: 3px 10px;
          border-radius: 10px;
        }
        .about-links {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
        }
        .about-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--ap-accent-blue, #03a9f4);
          text-decoration: none;
        }
        .about-link:hover {
          text-decoration: underline;
        }
        .about-credits {
          margin: 0;
          font-size: 11px;
          color: var(--secondary-text-color, #666);
        }
        .about-credits + .about-credits {
          margin-top: 3px;
        }
      </style>
      ${
        this._view === "edition"
          ? this._renderEditionToolbar()
          : `
      <div class="header">
        <div class="header-left">
          <button class="icon-button back-btn" title="${this._view === "settings" ? "Retour au Dashboard" : "Retour à Home Assistant"}">
            ${this._icon(ICON_ARROW_LEFT, 22)}
          </button>
          <svg class="wordmark" viewBox="0 0 860 240" width="122" height="34" role="img" aria-label="AutomationPlus">${WORDMARK_SVG_INNER}</svg>
          <a class="version-badge" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer" title="Voir les releases sur GitHub">v${DEBUG_VERSION}</a>
        </div>
        <div class="header-actions">
          <button class="icon-button report-bug-btn" title="Signaler un bug">
            ${this._icon(ICON_BUG, 22)}
          </button>
          <button class="icon-button" title="Bientôt disponible" disabled>
            ${this._icon(ICON_HELP_CIRCLE, 22)}
          </button>
          <button class="icon-button settings-btn-header" title="Paramètres">
            ${this._icon(ICON_SETTINGS, 22)}
          </button>
        </div>
      </div>
      `
      }
      ${this._view === "settings" ? this._renderSettingsView() : this._view === "edition" ? this._renderEditionView() : this._renderDashboardView()}
      <div class="toast-container">${this._renderToast()}</div>
      ${this._editionHelpOpen ? this._renderEditionHelpPopup() : ""}
      ${this._deleteConfirmFor ? this._renderDeleteConfirmPopup() : ""}
      ${this._detailPopupFor ? this._renderAutomationDetailPopup() : ""}
    `;
    this._attachListeners();
  }

  // Bascule l'état d'une automatisation via le service HA standard
  // `automation.toggle` — jamais d'état optimiste : le state affiché reste
  // dérivé de hass.states, seule source de vérité, mise à jour par HA lui-même
  // (hass est réassigné très fréquemment, voir _renderPreservingFocus()).
  // `pending` bloque juste les clics répétés le temps de l'aller-retour.
  async _toggleAutomation(entityId) {
    if (!entityId || !this._hass || this._pendingToggles.has(entityId)) return;
    this._pendingToggles.add(entityId);
    this._renderListOnly();
    try {
      await this._hass.callService("automation", "toggle", { entity_id: entityId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AutomationPlus: échec du toggle d'automatisation", entityId, err);
      const stateObj = this._hass.states[entityId];
      const name = (stateObj && stateObj.attributes && stateObj.attributes.friendly_name) || entityId;
      this._showErrorToast(`Impossible de basculer « ${name} » — vérifiez vos permissions.`);
    } finally {
      this._pendingToggles.delete(entityId);
      this._renderListOnly();
    }
  }

  _attachListeners() {
    const root = this.shadowRoot;

    // .options-menu est en position: fixed (calculé au clic, voir
    // _positionOptionsMenu) : il ne suit plus la ligne pendant un scroll de
    // .scroll-area comme le ferait un position: absolute — on le ferme donc
    // au scroll plutôt que de le laisser se décaler visuellement.
    const scrollArea = root.querySelector(".scroll-area");
    if (scrollArea && this._optionsMenuOpenFor) {
      scrollArea.addEventListener(
        "scroll",
        () => {
          if (this._optionsMenuOpenFor) {
            this._optionsMenuOpenFor = null;
            this._render();
          }
        },
        { once: true }
      );
    }

    const searchInput = root.querySelector(".search-input");
    if (searchInput) {
      // Re-render partiel uniquement (_renderListOnly) : un _render() complet
      // recréerait le champ et ferait perdre le focus à chaque frappe.
      searchInput.addEventListener("input", (event) => {
        this._filterText = event.target.value;
        this._renderListOnly();
      });
    }

    const regroupBtn = root.querySelector(".regroup-btn");
    if (regroupBtn) {
      regroupBtn.addEventListener("click", () => {
        this._groupMenuOpen = !this._groupMenuOpen;
        this._sortMenuOpen = false;
        this._render();
      });
    }

    const sortBtn = root.querySelector(".sort-btn");
    if (sortBtn) {
      sortBtn.addEventListener("click", () => {
        this._sortMenuOpen = !this._sortMenuOpen;
        this._groupMenuOpen = false;
        this._render();
      });
    }

    root.querySelectorAll(".dropdown-option").forEach((option) => {
      option.addEventListener("click", () => {
        if (option.dataset.menu === "sort") {
          this._sortBy = option.dataset.value;
          this._sortMenuOpen = false;
        } else {
          this._groupBy = option.dataset.value;
          this._groupMenuOpen = false;
        }
        this._savePrefs();
        this._render();
      });
    });

    root.querySelectorAll(".dropdown-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", () => {
        this._groupMenuOpen = false;
        this._sortMenuOpen = false;
        this._optionsMenuOpenFor = null;
        this._editionBlockMenuOpenFor = null;
        this._render();
      });
    });

    root.querySelectorAll(".status-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        this._statusFilter = chip.dataset.value;
        this._savePrefs();
        this._render();
      });
    });

    root.querySelectorAll(".chip-clickable").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = chip.dataset.labelId;
        if (this._activeLabelFilters.has(id)) {
          this._activeLabelFilters.delete(id);
        } else {
          this._activeLabelFilters.add(id);
        }
        this._savePrefs();
        this._render();
      });
    });

    const resetLabelsChip = root.querySelector(".chip-reset");
    if (resetLabelsChip) {
      resetLabelsChip.addEventListener("click", () => {
        this._activeLabelFilters.clear();
        this._savePrefs();
        this._render();
      });
    }

    // Écouteur délégué sur le conteneur (pas sur chaque .state-toggle) :
    // seul .innerHTML change lors d'un _renderListOnly() (filtre de
    // recherche), le conteneur lui-même reste le même élément — un
    // écouteur posé directement sur chaque toggle serait perdu à la
    // prochaine frappe dans le champ de recherche.
    const listContainer = root.querySelector(".list-container");
    if (listContainer) {
      listContainer.addEventListener("click", (event) => {
        const toggle = event.target.closest(".state-toggle");
        if (toggle) {
          this._toggleAutomation(toggle.dataset.entityId);
          return;
        }

        const optionsBtn = event.target.closest(".options-btn");
        if (optionsBtn) {
          const id = optionsBtn.dataset.entityId;
          const opening = this._optionsMenuOpenFor !== id;
          this._optionsMenuOpenFor = opening ? id : null;
          this._render();
          if (opening) {
            // .options-menu est en position: fixed (voir CSS) — un seul
            // ouvert à la fois, positionné par rapport à son bouton kebab
            // (frère dans .options-wrap, voir _renderAutomationRow).
            const menuEl = root.querySelector(".options-menu");
            const newBtn = menuEl && menuEl.parentElement.querySelector(".options-btn");
            if (menuEl && newBtn) {
              this._positionOptionsMenu(newBtn, menuEl);
            }
          }
          return;
        }

        const menuItem = event.target.closest(".options-menu-item");
        if (menuItem) {
          if (menuItem.classList.contains("disabled")) return;
          const action = menuItem.dataset.action;
          const entityId = menuItem.dataset.entityId;
          this._optionsMenuOpenFor = null;
          this._handleOptionsAction(action, entityId);
          return;
        }
        // Le menu Options ouvert (.options-menu, position: fixed) reste un
        // descendant DOM de .automation-row — exclure toute la zone (pas
        // seulement .options-menu-item) pour ne pas déclencher l'édition en
        // cliquant sur son fond/espacement.
        if (event.target.closest(".options-menu")) return;

        // Clic sur la ligne elle-même (hors toggle État/menu Options déjà
        // gérés ci-dessus) : ouvre la page Édition de cette automatisation.
        const row = event.target.closest(".automation-row:not(.automation-row-header)");
        if (row) {
          this._openEdition(this._findAutomation(row.dataset.entityId));
        }
      });
    }

    const deletePopup = root.querySelector('.popup-overlay[data-popup="delete"]');
    if (deletePopup) {
      deletePopup.addEventListener("click", (event) => {
        if (event.target === deletePopup) {
          this._closeDeleteConfirm();
          return;
        }
        const actionEl = event.target.closest("[data-action]");
        if (!actionEl) return;
        if (actionEl.dataset.action === "cancel-delete") {
          this._closeDeleteConfirm();
        } else if (actionEl.dataset.action === "confirm-delete") {
          this._deleteAutomation(this._deleteConfirmFor);
        }
      });
    }

    const detailPopup = root.querySelector('.popup-overlay[data-popup="detail"]');
    if (detailPopup) {
      detailPopup.addEventListener("click", (event) => {
        if (event.target === detailPopup) {
          this._closeDetailPopup();
          return;
        }
        const actionEl = event.target.closest("[data-action]");
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        if (action === "cancel-detail") {
          this._closeDetailPopup();
        } else if (action === "save-detail") {
          this._saveAutomationDetails();
        } else if (action === "toggle-activation") {
          this._detailDraft.activated = !this._detailDraft.activated;
          this._render();
        } else if (action === "remove-label") {
          this._detailDraft.labelIds = this._detailDraft.labelIds.filter(
            (id) => id !== actionEl.dataset.labelId
          );
          this._render();
        } else if (action === "regenerate-entity-id") {
          const slug = this._slugifyName(this._detailDraft.name);
          this._detailDraft.entityId = `automation.${slug}`;
          this._render();
        }
      });
      // Champs texte/sélecteurs : mise à jour silencieuse du brouillon (pas
      // de _render() sur "input" pour ne pas faire perdre le focus en cours
      // de frappe, voir _renderPreservingFocus() pour le même principe).
      detailPopup.querySelectorAll("[data-field]").forEach((field) => {
        if (field.dataset.field === "add-label") return;
        field.addEventListener(field.tagName === "SELECT" ? "change" : "input", () => {
          this._detailDraft[field.dataset.field] = field.value;
        });
      });
      const addLabelSelect = detailPopup.querySelector('[data-field="add-label"]');
      if (addLabelSelect) {
        addLabelSelect.addEventListener("change", () => {
          const value = addLabelSelect.value;
          if (value && !this._detailDraft.labelIds.includes(value)) {
            this._detailDraft.labelIds.push(value);
          }
          this._render();
        });
      }
    }

    const toastContainer = root.querySelector(".toast-container");
    if (toastContainer) {
      toastContainer.addEventListener("click", (event) => {
        if (event.target.closest(".toast-close")) {
          this._dismissErrorToast();
        }
      });
    }

    // FAB "+" : pas encore de lien vers la page Édition (pas codée), voir
    // BACKLOG.md — le bouton reste visuellement en place mais inactif.

    const backBtn = root.querySelector(".back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (this._view === "settings" || this._view === "edition") {
          this._view = "dashboard";
          this._render();
        } else {
          history.back();
        }
      });
    }

    const editionTitleBtn = root.querySelector(".edition-title");
    if (editionTitleBtn) {
      editionTitleBtn.addEventListener("click", () => {
        if (this._editionAutomation) this._openDetailPopup(this._editionAutomation);
      });
    }

    const discardEditionBtn = root.querySelector('[data-action="discard-edition-changes"]');
    if (discardEditionBtn) {
      discardEditionBtn.addEventListener("click", () => {
        this._editionDiscardChanges();
      });
    }

    const undoEditionBtn = root.querySelector('[data-action="undo-edition"]');
    if (undoEditionBtn) {
      undoEditionBtn.addEventListener("click", () => {
        this._editionUndo();
      });
    }

    const redoEditionBtn = root.querySelector('[data-action="redo-edition"]');
    if (redoEditionBtn) {
      redoEditionBtn.addEventListener("click", () => {
        this._editionRedo();
      });
    }

    const editionViewSelector = root.querySelector(".edition-view-selector");
    if (editionViewSelector) {
      editionViewSelector.addEventListener("click", (event) => {
        const segment = event.target.closest(".edition-segment[data-sub-view]");
        if (!segment || segment.classList.contains("disabled")) return;
        const subView = segment.dataset.subView;
        if (subView === this._editionSubView) return;
        this._editionSubView = subView;
        this._render();
      });
    }

    const editionHelpBtn = root.querySelector(".edition-help-btn");
    if (editionHelpBtn) {
      editionHelpBtn.addEventListener("click", () => {
        this._editionHelpOpen = true;
        this._render();
      });
    }

    const editionHelpPopup = root.querySelector('.popup-overlay[data-popup="edition-help"]');
    if (editionHelpPopup) {
      editionHelpPopup.addEventListener("click", (event) => {
        if (event.target === editionHelpPopup || event.target.closest('[data-action="close-edition-help"]')) {
          this._editionHelpOpen = false;
          this._render();
        }
      });
    }

    const reportBugBtn = root.querySelector(".report-bug-btn");
    if (reportBugBtn) {
      reportBugBtn.addEventListener("click", () => {
        window.open(ISSUES_URL, "_blank", "noopener,noreferrer");
      });
    }

    const settingsBtnHeader = root.querySelector(".settings-btn-header");
    if (settingsBtnHeader) {
      settingsBtnHeader.addEventListener("click", () => {
        this._view = "settings";
        this._render();
      });
    }

    // Écouteur délégué sur .settings-view : les blocs Réglages sont
    // recréés à chaque _render() (résultats de vérif/export), un seul
    // listener sur le conteneur stable évite d'avoir à le reposer.
    const settingsView = root.querySelector(".settings-view");
    if (settingsView) {
      settingsView.addEventListener("click", (event) => {
        const actionEl = event.target.closest("[data-action]");
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        if (action === "check-config") {
          this._checkConfig();
        } else if (action === "check-yaml") {
          this._checkYaml();
        } else if (action === "export") {
          this._exportAutomations();
        } else if (action === "nav-labels") {
          this._navigateHa("/config/labels");
        } else if (action === "nav-areas") {
          this._navigateHa("/config/areas/dashboard");
        }
      });
    }

    // Panneau Paramètres + Sidebar Palette fonctionnels (issues #101/#102)
    // — un seul conteneur délégué pour sélection/suppression de bloc,
    // insertion depuis la palette, fermeture, toggle booléen et ajout de
    // clé (repli générique), même pattern que .settings-view/.list-container
    // ci-dessus.
    const editionListeBody = root.querySelector(".edition-liste-body");
    if (editionListeBody) {
      editionListeBody.addEventListener("click", (event) => {
        // Glisser-déposer (issue #110) : un pointerup qui a dépassé le seuil
        // d'activation du drag peut être suivi d'un "click" fantôme du
        // navigateur (recalculé sur le DOM reconstruit par le _render() du
        // déplacement) — ce drapeau, posé juste avant ce _render(), absorbe
        // ce click une seule fois quel que soit l'élément qu'il cible.
        if (this._editionSuppressNextClick) {
          this._editionSuppressNextClick = false;
          return;
        }
        // Poignée de glisser-déposer (issue #110) — zone morte pour le clic,
        // gérée uniquement via pointerdown/pointermove/pointerup ci-dessous ;
        // ne doit jamais (dé)sélectionner la carte.
        if (event.target.closest(".edition-block-handle")) return;

        const toggle = event.target.closest(".edition-field-toggle");
        if (toggle) {
          const key = toggle.dataset.fieldKey;
          const next = toggle.dataset.value !== "true";
          this._editionSetBlockField(key, "boolean", next);
          return;
        }

        // Chip d'un jour du champ "weekday" (issue #102, ajustement
        // post-review, ex. trigger:time) — bascule ce jour dans/hors du
        // tableau, les autres jours ne sont jamais touchés.
        const weekdayChip = event.target.closest('[data-action="toggle-weekday"]');
        if (weekdayChip) {
          this._editionToggleWeekdayDay(weekdayChip.dataset.fieldKey, weekdayChip.dataset.day);
          return;
        }

        const closeBtn = event.target.closest(".edition-settings-close");
        if (closeBtn) {
          this._selectedBlock = null;
          this._render();
          return;
        }

        // Bouton "Supprimer le bloc" du Panneau Paramètres (issue #102) —
        // réutilise _editionDeleteBlock() tel quel (menu kebab, #105).
        const deleteBtn = event.target.closest('[data-action="delete-block"]');
        if (deleteBtn) {
          if (!this._selectedBlock) return;
          this._editionDeleteBlock(this._selectedBlock.category, this._selectedBlock.index);
          return;
        }

        // Item de la Sidebar Palette (issue #102) — insertion en fin du
        // groupe top-level correspondant, sélection automatique du bloc créé.
        const paletteItem = event.target.closest('.edition-palette-item[data-action="insert-block"]');
        if (paletteItem) {
          this._editionInsertBlock(paletteItem.dataset.category, paletteItem.dataset.typeKey);
          return;
        }

        // Onglet du switcher de catégories palette (issue #102, ajustement
        // post-review) — grisé/inerte pendant une recherche (voir CSS
        // .edition-palette-tabs.disabled), donc rien à vérifier de plus ici.
        const paletteTab = event.target.closest('.edition-palette-tab[data-action="palette-tab"]');
        if (paletteTab) {
          this._editionPaletteActiveCategory = paletteTab.dataset.category;
          this._render();
          return;
        }

        // Bouton "Ajouter un déclencheur/condition/action" en bas de chaque
        // groupe de la Zone Centrale (issue #102, ajustement post-review) —
        // redirige vers la Palette plutôt qu'un popup dédié (décision
        // explicite) : bascule l'onglet sur la catégorie correspondante et
        // efface une recherche en cours pour la rendre immédiatement visible.
        const focusPaletteBtn = event.target.closest('[data-action="focus-palette-category"]');
        if (focusPaletteBtn) {
          this._editionPaletteActiveCategory = focusPaletteBtn.dataset.category;
          this._editionPaletteQuery = "";
          this._render();
          return;
        }

        const addRawBtn = event.target.closest('[data-action="add-raw-field"]');
        if (addRawBtn) {
          const wrap = addRawBtn.closest(".edition-field-raw-add");
          const keyInput = wrap && wrap.querySelector(".edition-raw-add-key");
          const valueInput = wrap && wrap.querySelector(".edition-raw-add-value");
          if (keyInput && keyInput.value.trim()) {
            this._editionAddRawField(keyInput.value, valueInput ? valueInput.value : "");
          }
          return;
        }

        // Toggle actif/inactif d'un bloc (issue #105) — avant le fallback
        // sélection de carte, sinon le clic sur le toggle sélectionnerait
        // aussi la carte.
        const blockToggle = event.target.closest('[data-action="toggle-block-enabled"]');
        if (blockToggle) {
          this._editionToggleBlockEnabled(blockToggle.dataset.category, Number(blockToggle.dataset.index));
          return;
        }

        // Bouton kebab d'une carte de bloc (issue #105) — même logique de
        // positionnement que le menu Options automatisation du Dashboard
        // (_positionOptionsMenu, .options-menu en position: fixed).
        const blockMenuBtn = event.target.closest('[data-action="block-menu"]');
        if (blockMenuBtn) {
          const category = blockMenuBtn.dataset.category;
          const index = Number(blockMenuBtn.dataset.index);
          const opening =
            !this._editionBlockMenuOpenFor || this._editionBlockMenuOpenFor.category !== category || this._editionBlockMenuOpenFor.index !== index;
          this._editionBlockMenuOpenFor = opening ? { category, index } : null;
          this._render();
          if (opening) {
            const menuEl = root.querySelector(".options-menu");
            const newBtn = menuEl && menuEl.parentElement.querySelector(".edition-block-kebab");
            if (menuEl && newBtn) {
              this._positionOptionsMenu(newBtn, menuEl);
            }
          }
          return;
        }

        // Item du menu kebab bloc (Dupliquer/Activer-Désactiver/Supprimer).
        const blockMenuItem = event.target.closest(".options-menu-item[data-category]");
        if (blockMenuItem) {
          this._handleEditionBlockMenuAction(blockMenuItem.dataset.action, blockMenuItem.dataset.category, Number(blockMenuItem.dataset.index));
          return;
        }

        // Le menu kebab ouvert (.options-menu, position: fixed) reste un
        // descendant DOM de .edition-block-card — exclure toute la zone pour
        // ne pas déclencher la sélection de carte en cliquant sur son
        // fond/espacement (même précaution que le menu Options automatisation).
        if (event.target.closest(".options-menu")) return;

        const card = event.target.closest(".edition-block-card[data-category]");
        if (card) {
          const category = card.dataset.category;
          const index = Number(card.dataset.index);
          const already = this._isBlockSelected(category, index);
          this._selectedBlock = already ? null : { category, index };
          this._render();
        }
      });

      // "change" (blur/validation), pas "input" : un re-render complet à
      // chaque frappe casserait le focus/curseur en cours de saisie (pas de
      // rendu partiel dans ce projet, voir plan de l'issue #101).
      editionListeBody.addEventListener("change", (event) => {
        const field = event.target.closest("[data-field-key]");
        if (!field) return;
        this._editionSetBlockField(field.dataset.fieldKey, field.dataset.fieldType, field.value);
      });

      // Recherche de la Sidebar Palette (issue #102) : "input" pour un
      // filtrage live, mais SANS passer par _render() (qui reconstruit tout
      // .edition-liste-body et casserait le focus/curseur de cet input en
      // cours de frappe, même raison que le "change" ci-dessus) — patch DOM
      // ciblé sur .edition-palette-sections uniquement, l'input et le
      // footer de la palette ne sont jamais touchés. Le switcher de
      // catégories (issue #102, ajustement post-review) bascule en mode
      // "toutes catégories" pendant la recherche : grisé/inerte via la
      // classe .disabled, sans reconstruire ses nœuds.
      editionListeBody.addEventListener("input", (event) => {
        const searchInput = event.target.closest(".edition-palette-search-input");
        if (!searchInput) return;
        this._editionPaletteQuery = searchInput.value;
        const searching = searchInput.value.trim().length > 0;
        const tabs = editionListeBody.querySelector(".edition-palette-tabs");
        if (tabs) tabs.classList.toggle("disabled", searching);
        const sections = editionListeBody.querySelector(".edition-palette-sections");
        if (sections) sections.innerHTML = this._renderEditionPaletteSections();
      });

      // Glisser-déposer d'une carte (issue #110) — pointer events plutôt que
      // le Drag & Drop HTML5 natif, incompatible avec le pattern de
      // re-render complet du panel (un dragstart/dragover natif perd son
      // état dès que le DOM sous-jacent est reconstruit). Écouteurs
      // move/up posés sur window (pas de setPointerCapture nécessaire : les
      // écouteurs globaux suivent déjà le pointeur même hors de la poignée)
      // — retirés à chaque relâchement. Réordonnancement strictement borné au
      // groupe source (.edition-group-cards), jamais entre catégories : le
      // survol ne considère que les cartes du même conteneur que la carte
      // saisie. Seuil de 4px avant d'activer le drag (un simple clic net sur
      // la poignée ne doit rien déclencher, voir garde .edition-block-handle
      // du listener "click" ci-dessus).
      editionListeBody.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const handle = event.target.closest(".edition-block-handle");
        if (!handle) return;
        const card = handle.closest(".edition-block-card");
        const container = card && card.parentElement;
        if (!card || !container) return;
        // Empêche la sélection de texte native pendant le glisser (le
        // pointeur traverse le titre/résumé des cartes voisines) — sans ça,
        // Chromium démarre parfois un geste de sélection de texte au lieu
        // d'un clic, ce qui supprime le "click" de fin de geste que la garde
        // ._editionSuppressNextClick attend pour se réinitialiser (constaté
        // via Playwright : le drapeau restait bloqué à `true` et avalait le
        // clic suivant, légitime).
        event.preventDefault();

        const category = handle.dataset.category;
        const originIndex = Number(handle.dataset.index);
        const items = Array.from(container.children).filter((el) => el.classList.contains("edition-block-card"));
        const rects = items.map((el) => el.getBoundingClientRect());
        // Pas de translation possible s'il n'y a qu'un seul bloc dans le
        // groupe — rien à réordonner.
        if (items.length < 2) return;
        const step = (rects[items.length - 1].top - rects[0].top) / (items.length - 1);
        const startY = event.clientY;
        let dragging = false;
        let currentIndex = originIndex;

        const onMove = (moveEvent) => {
          const deltaY = moveEvent.clientY - startY;
          if (!dragging) {
            if (Math.abs(deltaY) < 4) return;
            dragging = true;
            this._editionBlockMenuOpenFor = null;
            card.classList.add("dragging");
            card.style.transition = "none";
          }
          card.style.transform = `translateY(${deltaY}px)`;

          let nextIndex = 0;
          let bestDist = Infinity;
          rects.forEach((rect, i) => {
            const dist = Math.abs(moveEvent.clientY - (rect.top + rect.height / 2));
            if (dist < bestDist) {
              bestDist = dist;
              nextIndex = i;
            }
          });
          if (nextIndex !== currentIndex) {
            currentIndex = nextIndex;
            items.forEach((el, i) => {
              if (i === originIndex) return;
              let shift = 0;
              if (currentIndex <= i && i < originIndex) shift = step;
              else if (originIndex < i && i <= currentIndex) shift = -step;
              el.style.transition = "transform 120ms ease";
              el.style.transform = shift ? `translateY(${shift}px)` : "";
            });
          }
        };

        const cleanup = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
        };

        // `commit` distingue pointerup (valide le déplacement en cours) de
        // pointercancel (revue #110, review) : un cancel — geste tactile
        // interrompu par le système, changement d'onglet — doit annuler le
        // déplacement, pas le valider à la position survolée au moment de
        // l'interruption.
        const finishDrag = (commit) => {
          cleanup();
          if (!dragging) return;
          // Posé avant le _render() de _editionMoveBlock (jamais après) : le
          // "click" fantôme du navigateur, dispatché sur le DOM reconstruit,
          // doit trouver ce drapeau déjà à `true` (voir garde ci-dessus).
          // Filet de sécurité : si aucun "click" ne suit finalement ce
          // relâchement (ex. le navigateur l'a supprimé de lui-même), un
          // clic normal ultérieur ne doit pas rester bloqué indéfiniment —
          // un "click" fantôme, lui, est toujours dispatché de façon
          // synchrone juste après le mouseup, donc avant ce setTimeout(0).
          this._editionSuppressNextClick = true;
          setTimeout(() => {
            this._editionSuppressNextClick = false;
          }, 0);
          if (commit && currentIndex !== originIndex) {
            this._editionMoveBlock(category, originIndex, currentIndex);
          } else {
            card.classList.remove("dragging");
            card.style.transition = "";
            card.style.transform = "";
            items.forEach((el) => {
              if (el === card) return;
              el.style.transition = "";
              el.style.transform = "";
            });
          }
        };

        const onUp = () => finishDrag(true);
        const onCancel = () => finishDrag(false);

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
      });
    }

    // Sidebar "Aller à" de la vue Code (issue #112) : délégation sur le
    // conteneur, même pattern que .edition-liste-body ci-dessus. Aucune
    // mutation d'état ici (pure navigation UI) — pas de _render() déclenché,
    // donc pas besoin de réattacher ce listener à chaque clic.
    const editionCodeBody = root.querySelector(".edition-code-body");
    if (editionCodeBody) {
      // Boutons "Aller à" (issue #112, ajustement post-review) : sélection
      // PERSISTANTE — reclic sur le même bouton désélectionne, cliquer un
      // autre bouton bascule directement dessus (jamais 2 actifs ensemble).
      // _render() reconstruit tout .edition-code-body (bouton actif + trait
      // vertical dérivés de l'état par _renderEditionCode*, voir plus haut),
      // puis le scroll est posé une fois le nouveau DOM en place.
      editionCodeBody.addEventListener("click", (event) => {
        const btn = event.target.closest('.edition-goto-btn[data-action="goto-category"]');
        if (!btn || btn.disabled) return;
        const category = btn.dataset.category;
        this._editionCodeActiveCategory = this._editionCodeActiveCategory === category ? null : category;
        this._render();
        this._scrollEditionCodeToActiveCategory();
      });

      // Recherche YAML de la sidebar Code (issue #112) : "input" pour un
      // filtrage/scroll live, mais SANS passer par _render() — même
      // contrainte que la recherche de la Palette en vue Liste (voir plus
      // bas) : reconstruire tout .edition-code-body casserait le focus/
      // curseur de ce champ en cours de frappe. Patch DOM ciblé sur
      // .edition-gutter/.edition-code uniquement, le champ recherche
      // lui-même n'est jamais touché.
      editionCodeBody.addEventListener("input", (event) => {
        const searchInput = event.target.closest(".edition-code-search-input");
        if (!searchInput) return;
        this._editionCodeSearchQuery = searchInput.value;
        const gutterEl = editionCodeBody.querySelector(".edition-gutter");
        if (gutterEl) gutterEl.innerHTML = this._renderEditionCodeGutter();
        const codeEl = editionCodeBody.querySelector(".edition-code");
        if (codeEl) codeEl.innerHTML = this._renderEditionCodeLines();
        this._scrollEditionCodeToFirstMatch();
      });
    }
  }
}

// Garde contre le double enregistrement : le module peut être ré-exécuté
// dans le même onglet navigateur (ex. restart HA sans rechargement complet
// de page) — sans cette garde, customElements.define() lève une exception
// qui interrompt tout le script avant connectedCallback(), d'où une page
// blanche. Un forçage de rechargement automatique a été tenté ici (v0.6.1)
// mais s'est révélé lui-même source de régression (interrompt le composant
// interne de HA en train de charger le panel) — retiré en v0.6.2.
if (!customElements.get("automation-plus-panel")) {
  customElements.define("automation-plus-panel", AutomationPlusPanel);
}
