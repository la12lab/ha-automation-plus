![AutomationPlus](./custom_components/automation_plus/brand/logo.png)

[![Version](https://img.shields.io/github/v/release/la12lab/ha-automation-plus?label=version&color=4f8eff&logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/releases/latest)
[![Date de release](https://img.shields.io/github/release-date/la12lab/ha-automation-plus?logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/releases/latest)
[![License: GPL-3.0](https://img.shields.io/github/license/la12lab/ha-automation-plus?logo=github&logoColor=9a9a9a)](LICENSE)
<br/>
[![Dernier commit](https://img.shields.io/github/last-commit/la12lab/ha-automation-plus?logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/commits/main)
[![Validate for HACS](https://img.shields.io/github/actions/workflow/status/la12lab/ha-automation-plus/hacs.yml?branch=main&label=Validate%20for%20HACS&logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/actions/workflows/hacs.yml)
[![Validate with hassfest](https://img.shields.io/github/actions/workflow/status/la12lab/ha-automation-plus/hassfest.yml?branch=main&label=Validate%20with%20hassfest&logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/actions/workflows/hassfest.yml)
<br/>
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?logo=home-assistant&logoColor=9a9a9a)](https://hacs.xyz/docs/faq/custom_repositories/)
[![Home Assistant minimum](https://img.shields.io/badge/Home%20Assistant-2024.1.0%2B-41BDF5?logo=home-assistant&logoColor=9a9a9a)](https://www.home-assistant.io/)
<br/>
[![Issues ouvertes](https://img.shields.io/github/issues/la12lab/ha-automation-plus?logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/issues)
[![Issues fermées](https://img.shields.io/github/issues-closed/la12lab/ha-automation-plus?logo=github&logoColor=9a9a9a)](https://github.com/la12lab/ha-automation-plus/issues?q=is%3Aissue+is%3Aclosed)
<br/>
[![Installations HA](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fanalytics.home-assistant.io%2Fcustom_integrations.json&label=installs%20HA&query=%24.automation_plus.total&logo=home-assistant&logoColor=9a9a9a)](https://analytics.home-assistant.io/)
[![GitHub Stars](https://img.shields.io/github/stars/la12lab/ha-automation-plus)](https://github.com/la12lab/ha-automation-plus/stargazers)

Panel Home Assistant (via HACS) pour visualiser et gérer les automatisations.

## Présentation

AutomationPlus ajoute un panel dédié dans la sidebar de Home Assistant pour
consulter et piloter ses automatisations, sans dépendre de l'éditeur YAML
natif — ni de la taille du fichier `automations.yaml`, ni de la façon dont
il est utilisé (fichier unique natif ou dossier dédié multi-fichiers).

*🇬🇧 AutomationPlus adds a dedicated panel to the Home Assistant sidebar to
view and manage your automations, without depending on the native YAML
editor — nor on the size of the `automations.yaml` file, nor on how it's
used (native single file or dedicated multi-file folder).*

## Installation

### Rapide (via HACS)

[![Ouvrir dans HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=la12lab&repository=ha-automation-plus&category=integration)
[![Ajouter l'intégration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=automation_plus)

**Ouvrir dans HACS** → installer **AutomationPlus** → redémarrer Home
Assistant → **Ajouter l'intégration**.

### Manuelle

1. HACS → Intégrations → menu ⋮ → **Custom repositories** → coller l'URL
   de ce dépôt, catégorie **Integration**
2. Installer **AutomationPlus**
3. Redémarrer Home Assistant
4. Paramètres → Appareils et services → **Ajouter une intégration** →
   rechercher **AutomationPlus**

Le panel apparaît dans la sidebar.

## Page Édition

### Vue Liste

État actuel de la vue Liste (édition par blocs) — **rien n'est encore
enregistré sur disque**, toute modification reste en mémoire et est perdue
au rechargement.

**Éditable**
- Sélectionner un bloc (déclencheur/condition/action) pour ouvrir son
  formulaire dans le panneau Paramètres
- Modifier ses champs (formulaire dédié pour les types courants, sinon
  clé/valeur brute pour les autres)
- Ajouter un bloc depuis la Palette (recherche incluse, un onglet par
  catégorie Déclencheurs/Conditions/Actions)
- Dupliquer, activer/désactiver ou supprimer un bloc (menu kebab de la carte)
- Réordonner les blocs par glisser-déposer (au sein d'un même groupe
  déclencheurs/conditions/actions uniquement)
- Annuler/Refaire pas à pas (undo/redo, jusqu'à 50 étapes)
- Annuler pour tout recharger depuis Home Assistant

**Non éditable**
- Enregistrer (écriture réelle vers Home Assistant)

### Vue Code

Lecture seule du YAML brut de l'automatisation, avec navigation :
- Sidebar de raccourcis pour sauter directement à la section
  Déclencheur/Condition/Action (désactivés si la section est absente),
  avec scroll automatique et surlignage du bloc correspondant
- Recherche live (insensible à la casse) dans le YAML affiché, avec
  surlignage des correspondances et scroll vers la première trouvée

**Non éditable**
- Modifier ou enregistrer le YAML depuis cette vue

## Roadmap

Sans date précise — grands axes de développement à venir :

| Item | Progress | Détail |
|---|---|---|
| 💻 Édition Code | 🔄 (lecture seule) | Mode d'édition du YAML brut |
| 🧩 Édition Bloc | 🔄 (édition en mémoire) | Mode d'édition par blocs |
| 🔀 Édition Graph | ⚪ | Mode d'édition sous forme de graphe visuel |
| 📁 Mode dossier dédié | ⚪ | Stockage alternatif en un fichier *.yaml par automatisation |
| 🎨 Personnalisation | ⚪ | Options de personnalisations du panel |
| 🌐 Traductions anglais | ⚪ | Traduction de l'interface en anglais |
| 📱 Design responsive smartphone | ⚪ | Adaptation de l'interface aux petits écrans (smartphone) |

## Développement

- `custom_components/automation_plus/__init__.py` — point d'entrée,
  enregistre le panel dans la sidebar
- `custom_components/automation_plus/http.py` — routes HTTP du mode de
  stockage "dossier dédié" (l'API HA native ne couvrant que
  `automations.yaml`)
- `custom_components/automation_plus/storage.py` — accès disque pour ce
  même mode
- `custom_components/automation_plus/config_flow.py` — configuration de
  l'intégration
- `custom_components/automation_plus/frontend/automation-panel.js` — web
  component du panel (vanilla JS)

## Licence

GPL-3.0 — voir [`LICENSE`](./LICENSE).
