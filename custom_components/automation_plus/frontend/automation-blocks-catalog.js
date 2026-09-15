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

// Catalogue statique des types de blocs (déclencheurs/conditions/actions) —
// issue #22. Aucune API HA n'expose cette traduction en résumé lisible :
// même l'éditeur visuel natif de HA la code en dur dans son propre frontend
// (fonctions describeTrigger/describeCondition/describeAction, non exposées).
// Fichier statique séparé du panel (chargé via import ES module), à relire
// et mettre à jour manuellement à chaque évolution notable des plateformes
// de trigger/condition/action de HA.
//
// BLOCK_REGISTRY_HA_VERSION : dernière version HA (core) contre laquelle ce
// registre a été relu — indépendante du numéro de version du panel lui-même.
export const BLOCK_REGISTRY_HA_VERSION = "2026.9.2";

const ICON_TOGGLE_RIGHT = `<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/>`;
const ICON_ALARM_CLOCK = `<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>`;
const ICON_MAP_PIN = `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`;
const ICON_RADIO = `<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>`;
const ICON_CIRCLE_CHECK = `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`;
const ICON_CALENDAR_CLOCK = `<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M17.5 17.5 16 16.25V14"/><circle cx="16" cy="16" r="6"/>`;
const ICON_SIGMA = `<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6.2a2 2 0 0 1 0 2l-4.5 6.2a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>`;
const ICON_CODE = `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`;
const ICON_TERMINAL = `<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>`;
const ICON_HOURGLASS = `<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>`;
const ICON_BELL = `<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>`;
const ICON_SPLIT = `<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>`;
// Icône neutre du repli générique (plateforme non couverte par le registre).
const ICON_GENERIC = `<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>`;
// Icônes des types ajoutés lors de l'élargissement du catalogue (issue #22,
// lot 2) — mêmes tracés que lucide (déjà la source des icônes ci-dessus),
// certaines réutilisées entre plusieurs catégories (ex. Appareil, Soleil,
// Zone) quand le concept HA est identique côté déclencheur/condition/action.
const ICON_CALENDAR = `<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>`;
const ICON_MESSAGE_SQUARE = `<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>`;
const ICON_CPU = `<path d="M12 20v2"/><path d="M12 2v2"/><path d="M17 20v2"/><path d="M17 2v2"/><path d="M2 12h2"/><path d="M2 17h2"/><path d="M2 7h2"/><path d="M20 12h2"/><path d="M20 17h2"/><path d="M20 7h2"/><path d="M7 20v2"/><path d="M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>`;
const ICON_CROSSHAIR = `<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`;
const ICON_HOME = `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`;
const ICON_WIFI = `<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>`;
const ICON_SUN = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`;
const ICON_TAG = `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`;
const ICON_CLOCK = `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`;
const ICON_WEBHOOK = `<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>`;
const ICON_LIST_CHECKS = `<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>`;
const ICON_LIST = `<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>`;
const ICON_BAN = `<circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/>`;
const ICON_FLAG = `<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>`;
const ICON_REPEAT = `<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`;
const ICON_COLUMNS_2 = `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>`;
const ICON_OCTAGON = `<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/>`;
const ICON_VARIABLE = `<path d="M8 21s-4-3-4-9 4-9 4-9"/><path d="M16 3s4 3 4 9-4 9-4 9"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>`;
const ICON_SEND = `<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>`;
const ICON_REPLY = `<path d="M20 18v-2a4 4 0 0 0-4-4H4"/><path d="m9 17-5-5 5-5"/>`;

function entityLabel(hass, entityId) {
  if (!entityId) return "";
  const friendly = hass?.states?.[entityId]?.attributes?.friendly_name;
  return friendly || entityId;
}

function entityListLabel(hass, entityIdOrList) {
  const ids = Array.isArray(entityIdOrList) ? entityIdOrList : [entityIdOrList];
  return ids.filter(Boolean).map((id) => entityLabel(hass, id)).join(", ");
}

function formatDuration(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const parts = [];
    if (value.hours) parts.push(`${value.hours} h`);
    if (value.minutes) parts.push(`${value.minutes} min`);
    if (value.seconds) parts.push(`${value.seconds} s`);
    return parts.join(" ") || "durée non précisée";
  }
  return "durée non précisée";
}

function compactSummary(config, skipKeys) {
  const entries = Object.entries(config).filter(([key]) => !skipKeys.includes(key));
  if (entries.length === 0) return "Aucun paramètre";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" · ");
}

// Repli générique : n'importe quelle plateforme/service HA non listée
// ci-dessous reste affichée (icône neutre + clé brute + résumé compact),
// plutôt que de faire disparaître le bloc de la vue Liste.
function genericFallback(kind, typeKey, config, skipKeys) {
  return {
    icon: ICON_GENERIC,
    title: typeKey ? `${kind} : ${typeKey}` : kind,
    summary: compactSummary(config, skipKeys),
  };
}

export function describeTrigger(trigger, hass) {
  const typeKey = trigger.trigger ?? trigger.platform;
  switch (typeKey) {
    case "state": {
      const entity = entityListLabel(hass, trigger.entity_id);
      const to = trigger.to !== undefined ? ` passe à "${trigger.to}"` : " change d'état";
      return {
        icon: ICON_TOGGLE_RIGHT,
        title: "État d'une entité",
        summary: `Quand ${entity || "l'entité"}${to}`,
      };
    }
    case "time": {
      const at = Array.isArray(trigger.at) ? trigger.at.join(", ") : trigger.at;
      return { icon: ICON_ALARM_CLOCK, title: "Heure", summary: `Tous les jours à ${at ?? "?"}` };
    }
    case "zone": {
      const entity = entityListLabel(hass, trigger.entity_id);
      const verb = trigger.event === "leave" ? "sort de" : "entre dans";
      return {
        icon: ICON_MAP_PIN,
        title: "Zone",
        summary: `Quand ${entity || "l'entité"} ${verb} ${trigger.zone ?? "la zone"}`,
      };
    }
    case "event": {
      return { icon: ICON_RADIO, title: "Événement HA", summary: `Sur l'événement "${trigger.event_type ?? "?"}"` };
    }
    case "calendar": {
      const entity = entityLabel(hass, trigger.entity_id);
      const verb = trigger.event === "end" ? "se termine" : "commence";
      return { icon: ICON_CALENDAR, title: "Calendrier", summary: `Quand un événement ${entity ? `de ${entity} ` : ""}${verb}` };
    }
    case "conversation": {
      const commands = (Array.isArray(trigger.command) ? trigger.command : [trigger.command]).filter(Boolean);
      return {
        icon: ICON_MESSAGE_SQUARE,
        title: "Phrase (Assist)",
        summary: commands[0] ? `Quand la phrase "${commands[0]}" est dite` : "Quand une phrase est dite",
      };
    }
    case "device": {
      return {
        icon: ICON_CPU,
        title: "Appareil",
        summary: trigger.type ? `${trigger.type} (device_id : ${trigger.device_id ?? "?"})` : `device_id : ${trigger.device_id ?? "?"}`,
      };
    }
    case "geo_location": {
      const verb = trigger.event === "leave" ? "sort de" : "entre dans";
      return {
        icon: ICON_CROSSHAIR,
        title: "Géolocalisation",
        summary: `Quand ${trigger.source ?? "une source"} ${verb} ${trigger.zone ?? "la zone"}`,
      };
    }
    case "homeassistant": {
      const label = trigger.event === "shutdown" ? "s'arrête" : "démarre";
      return { icon: ICON_HOME, title: "Home Assistant", summary: `Quand Home Assistant ${label}` };
    }
    case "mqtt": {
      return { icon: ICON_WIFI, title: "MQTT", summary: trigger.topic ? `Message reçu sur "${trigger.topic}"` : "Message MQTT reçu" };
    }
    case "numeric_state": {
      const entity = entityListLabel(hass, trigger.entity_id);
      const parts = [];
      if (trigger.above !== undefined) parts.push(`> ${trigger.above}`);
      if (trigger.below !== undefined) parts.push(`< ${trigger.below}`);
      return {
        icon: ICON_SIGMA,
        title: "Valeur numérique",
        summary: `${entity || "L'entité"} ${parts.join(" et ") || "franchit un seuil"}`,
      };
    }
    case "persistent_notification": {
      return { icon: ICON_BELL, title: "Notification persistante", summary: "Quand une notification persistante est mise à jour" };
    }
    case "sun": {
      const label = trigger.event === "sunset" ? "se couche" : "se lève";
      return { icon: ICON_SUN, title: "Soleil", summary: `Quand le soleil ${label}` };
    }
    case "tag": {
      return { icon: ICON_TAG, title: "Tag scanné", summary: trigger.tag_id ? `Quand le tag "${trigger.tag_id}" est scanné` : "Quand un tag est scanné" };
    }
    case "template": {
      const template = String(trigger.value_template ?? "").trim();
      return {
        icon: ICON_CODE,
        title: "Modèle Jinja2",
        summary: template.length > 60 ? `${template.slice(0, 60)}…` : template || "(vide)",
      };
    }
    case "time_pattern": {
      const parts = [];
      if (trigger.hours !== undefined) parts.push(`heures : ${trigger.hours}`);
      if (trigger.minutes !== undefined) parts.push(`minutes : ${trigger.minutes}`);
      if (trigger.seconds !== undefined) parts.push(`secondes : ${trigger.seconds}`);
      return { icon: ICON_CLOCK, title: "Motif horaire", summary: parts.join(" · ") || "Motif périodique" };
    }
    case "webhook": {
      return { icon: ICON_WEBHOOK, title: "Webhook", summary: trigger.webhook_id ? `Réception sur "${trigger.webhook_id}"` : "Réception d'un webhook" };
    }
    default:
      return genericFallback("Déclencheur", typeKey, trigger, ["trigger", "platform"]);
  }
}

export function describeCondition(condition, hass) {
  const typeKey = condition.condition;
  switch (typeKey) {
    case "state": {
      const entity = entityListLabel(hass, condition.entity_id);
      return {
        icon: ICON_CIRCLE_CHECK,
        title: "État",
        summary: `${entity || "L'entité"} est à "${condition.state ?? "?"}"`,
      };
    }
    case "time": {
      const parts = [];
      if (condition.after) parts.push(`après ${condition.after}`);
      if (condition.before) parts.push(`avant ${condition.before}`);
      return { icon: ICON_CALENDAR_CLOCK, title: "Plage horaire", summary: parts.join(" et ") || "Toute heure" };
    }
    case "numeric_state": {
      const entity = entityListLabel(hass, condition.entity_id);
      const parts = [];
      if (condition.above !== undefined) parts.push(`> ${condition.above}`);
      if (condition.below !== undefined) parts.push(`< ${condition.below}`);
      return {
        icon: ICON_SIGMA,
        title: "Valeur numérique",
        summary: `${entity || "L'entité"} ${parts.join(" et ") || "a une valeur numérique"}`,
      };
    }
    case "template": {
      const template = String(condition.value_template ?? "").trim();
      return {
        icon: ICON_CODE,
        title: "Modèle Jinja2",
        summary: template.length > 60 ? `${template.slice(0, 60)}…` : template || "(vide)",
      };
    }
    case "and": {
      const count = Array.isArray(condition.conditions) ? condition.conditions.length : 0;
      return { icon: ICON_LIST_CHECKS, title: "Et (toutes)", summary: count ? `${count} conditions doivent être vraies` : "Toutes les conditions doivent être vraies" };
    }
    case "or": {
      const count = Array.isArray(condition.conditions) ? condition.conditions.length : 0;
      return { icon: ICON_LIST, title: "Ou (au moins une)", summary: count ? `Au moins 1 des ${count} conditions doit être vraie` : "Au moins une condition doit être vraie" };
    }
    case "not": {
      const count = Array.isArray(condition.conditions) ? condition.conditions.length : 0;
      return { icon: ICON_BAN, title: "Non (aucune)", summary: count ? `Aucune des ${count} conditions ne doit être vraie` : "Aucune condition ne doit être vraie" };
    }
    case "device": {
      return {
        icon: ICON_CPU,
        title: "Appareil",
        summary: condition.type ? `${condition.type} (device_id : ${condition.device_id ?? "?"})` : `device_id : ${condition.device_id ?? "?"}`,
      };
    }
    case "sun": {
      const parts = [];
      if (condition.after) parts.push(`après ${condition.after}`);
      if (condition.before) parts.push(`avant ${condition.before}`);
      return { icon: ICON_SUN, title: "Soleil", summary: parts.join(" et ") || "Position du soleil" };
    }
    case "trigger": {
      const ids = Array.isArray(condition.id) ? condition.id.join(", ") : condition.id;
      return { icon: ICON_FLAG, title: "Déclenché par", summary: ids ? `Si déclenché par "${ids}"` : "Si déclenché par un trigger précis" };
    }
    case "zone": {
      const entity = entityListLabel(hass, condition.entity_id);
      return { icon: ICON_MAP_PIN, title: "Zone", summary: `${entity || "L'entité"} est dans ${condition.zone ?? "la zone"}` };
    }
    default:
      return genericFallback("Condition", typeKey, condition, ["condition"]);
  }
}

export function describeAction(action, hass) {
  if (action.service !== undefined || action.action !== undefined) {
    const service = action.service ?? action.action;
    if (typeof service === "string" && service.startsWith("notify.")) {
      const message = action.data?.message ?? action.data?.title ?? "";
      return { icon: ICON_BELL, title: "Notification", summary: message ? `"${message}"` : service };
    }
    const target = entityListLabel(hass, action.target?.entity_id ?? action.entity_id);
    return {
      icon: ICON_TERMINAL,
      title: "Appeler un service",
      summary: target ? `${service} → ${target}` : service,
    };
  }
  if (action.delay !== undefined) {
    return { icon: ICON_HOURGLASS, title: "Attendre", summary: `Pendant ${formatDuration(action.delay)}` };
  }
  if (action.wait_template !== undefined || action.wait_for_trigger !== undefined) {
    return { icon: ICON_HOURGLASS, title: "Attendre", summary: "Attendre qu'une condition soit vraie" };
  }
  if (action.choose !== undefined || action.if !== undefined) {
    const branches = Array.isArray(action.choose) ? action.choose.length : action.if ? 1 : 0;
    return {
      icon: ICON_SPLIT,
      title: "Choisir (si/alors)",
      summary: branches ? `${branches} cas` : "Structure conditionnelle",
    };
  }
  if (action.repeat !== undefined) {
    const r = action.repeat ?? {};
    let detail = "Séquence répétée";
    if (r.count !== undefined) detail = `${r.count} fois`;
    else if (r.while !== undefined) detail = "Tant qu'une condition est vraie";
    else if (r.until !== undefined) detail = "Jusqu'à ce qu'une condition soit vraie";
    else if (r.for_each !== undefined) detail = "Pour chaque élément d'une liste";
    return { icon: ICON_REPEAT, title: "Répéter", summary: detail };
  }
  if (action.parallel !== undefined) {
    const count = Array.isArray(action.parallel) ? action.parallel.length : 0;
    return { icon: ICON_COLUMNS_2, title: "En parallèle", summary: count ? `${count} actions en parallèle` : "Actions en parallèle" };
  }
  if (action.stop !== undefined) {
    const reason = typeof action.stop === "string" ? action.stop : action.reason;
    return { icon: ICON_OCTAGON, title: "Arrêter", summary: reason ? `Arrêt : ${reason}` : "Arrête la séquence" };
  }
  if (action.variables !== undefined) {
    const names = Object.keys(action.variables ?? {}).join(", ");
    return { icon: ICON_VARIABLE, title: "Définir des variables", summary: names || "Aucune variable" };
  }
  if (action.device_id !== undefined) {
    return {
      icon: ICON_CPU,
      title: "Appareil",
      summary: action.type ? `${action.type} (device_id : ${action.device_id})` : `device_id : ${action.device_id}`,
    };
  }
  if (action.event !== undefined) {
    return { icon: ICON_SEND, title: "Déclencher un événement", summary: `Événement "${action.event}"` };
  }
  if (action.set_conversation_response !== undefined) {
    const response = String(action.set_conversation_response ?? "").trim();
    return {
      icon: ICON_REPLY,
      title: "Réponse de conversation",
      summary: response.length > 60 ? `${response.slice(0, 60)}…` : response || "(vide)",
    };
  }
  if (action.condition !== undefined) {
    const described = describeCondition(action, hass);
    return { ...described, title: `Condition : ${described.title}` };
  }
  const typeKey = Object.keys(action)[0];
  return genericFallback("Action", typeKey, action, []);
}

// Métadonnées pures (icône + titre, sans résumé) des 40 types de blocs
// couverts par le registre (17 déclencheurs, 11 conditions, 12 actions) —
// pilote la Sidebar Palette de la vue Liste (#5), qui n'a besoin que de la
// liste des types disponibles, pas d'une automatisation réelle à décrire.
export const BLOCK_TYPES = {
  trigger: [
    { icon: ICON_TOGGLE_RIGHT, title: "État d'une entité" },
    { icon: ICON_ALARM_CLOCK, title: "Heure" },
    { icon: ICON_MAP_PIN, title: "Zone" },
    { icon: ICON_RADIO, title: "Événement HA" },
    { icon: ICON_CALENDAR, title: "Calendrier" },
    { icon: ICON_MESSAGE_SQUARE, title: "Phrase (Assist)" },
    { icon: ICON_CPU, title: "Appareil" },
    { icon: ICON_CROSSHAIR, title: "Géolocalisation" },
    { icon: ICON_HOME, title: "Home Assistant" },
    { icon: ICON_WIFI, title: "MQTT" },
    { icon: ICON_SIGMA, title: "Valeur numérique" },
    { icon: ICON_BELL, title: "Notification persistante" },
    { icon: ICON_SUN, title: "Soleil" },
    { icon: ICON_TAG, title: "Tag scanné" },
    { icon: ICON_CODE, title: "Modèle Jinja2" },
    { icon: ICON_CLOCK, title: "Motif horaire" },
    { icon: ICON_WEBHOOK, title: "Webhook" },
  ],
  condition: [
    { icon: ICON_CIRCLE_CHECK, title: "État" },
    { icon: ICON_CALENDAR_CLOCK, title: "Plage horaire" },
    { icon: ICON_SIGMA, title: "Valeur numérique" },
    { icon: ICON_CODE, title: "Modèle Jinja2" },
    { icon: ICON_LIST_CHECKS, title: "Et (toutes)" },
    { icon: ICON_LIST, title: "Ou (au moins une)" },
    { icon: ICON_BAN, title: "Non (aucune)" },
    { icon: ICON_CPU, title: "Appareil" },
    { icon: ICON_SUN, title: "Soleil" },
    { icon: ICON_FLAG, title: "Déclenché par" },
    { icon: ICON_MAP_PIN, title: "Zone" },
  ],
  action: [
    { icon: ICON_TERMINAL, title: "Appeler un service" },
    { icon: ICON_HOURGLASS, title: "Attendre" },
    { icon: ICON_BELL, title: "Notification" },
    { icon: ICON_SPLIT, title: "Choisir (si/alors)" },
    { icon: ICON_REPEAT, title: "Répéter" },
    { icon: ICON_COLUMNS_2, title: "En parallèle" },
    { icon: ICON_OCTAGON, title: "Arrêter" },
    { icon: ICON_VARIABLE, title: "Définir des variables" },
    { icon: ICON_CPU, title: "Appareil" },
    { icon: ICON_SEND, title: "Déclencher un événement" },
    { icon: ICON_REPLY, title: "Réponse de conversation" },
    { icon: ICON_CIRCLE_CHECK, title: "Condition" },
  ],
};
