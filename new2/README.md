# mei-friend

**mei-friend** is an ecosystem for the Music Encoding Initiative (MEI), providing tools and applications for creating, editing, and analyzing digital music encodings. It consists of three primary components:

- **`@mei-friend/core`**: A foundational library for programmatically handling MEI structures and managing score lifecycles.
- **`@mei-friend/plugins`**: A collection of extensible modules that provide high-level functionality like rendering, editing, and annotation.
- **`@mei-friend/web-app`**: A full-featured web-based music notation editor that integrates the core and plugins into a cohesive user experience.

The web application serves as a **"last-mile" editor** for music encoding, specifically designed to streamline the cleanup of data generated through Optical Music Recognition (OMR) or conversion from other formats.

Originally developed as a plugin for the Atom text editor, **mei-friend** has been re-architected as a cross-browser web application and a modular toolkit, offering its functionalities as independent, reusable components.

The web application is available online at: **[https://mei-friend.mdw.ac.at](https://mei-friend.mdw.ac.at)**

---

## 🏗 New Architecture (v2)

This version (`new2/`) has been fully modernized using a **State-Service-View** architecture powered by **Zustand**, replacing the legacy DAG-based plugin system.

### Key Architectural Principles

- **Centralized State Management (State)**: A single source of truth using Zustand slices (e.g., `xml`, `selection`, `verovio`). This ensures consistent data across all panels and enables fine-grained reactivity.
- **Stateless Side-Effects (Service)**: Pure logic services that subscribe to the store and handle complex operations like Web Worker communication (Verovio), history management, and file I/O. Services do not own state and never touch the DOM.
- **Declarative UI (View)**: Modern React components that selectively subscribe to state slices. UI elements like SVG overlays and cursor positions are rendered declaratively based on data in the store.

### Benefits of the New Design

- **Performance**: Granular selectors ensure that a change in one slice (e.g., updating a BBox) does not trigger expensive re-renders in unrelated components (e.g., the CodeMirror editor).
- **Clean Synchronization**: Eliminated complex debouncing hacks and circular dependency workarounds. Bidirectional sync between XML and the rendered score is handled naturally through the centralized store.
- **Maintainability**: Clear separation between domain logic (slices), asynchronous side-effects (services), and presentation (React).

---

## Web Application Features

- **Advanced Editor**: Powered by CodeMirror, featuring code folding, tag matching, and MEI-schema-informed autocomplete.
- **Seamless File I/O**: Open files from local storage, via URL, or directly from GitHub. Integrated GitHub workflow supports forking, committing, and opening Pull Requests.
- **Music-Aware Navigation**: Navigate by sections, pages, or individual notes and rests with tight coupling between the MEI source and the rendered notation.
- **Schema Validation**: Automatic validation against MEI RNG schemas using `libxml2`.
- **Facsimile Editing**: Interactive management of facsimile zones, allowing for resizing, panning, and automated ingestion of external images.
- **Annotation Tools**: Support for generating in-line `<annot>` elements and visualizing stand-off Web Annotations.
- **Configurable UI**: Customizable layouts, themes (including dark mode), and scaling factors for both notation and text.

## Toolkit Features

### `@mei-friend/core`

The core package provides the infrastructure for managing MEI data:

- **`MeiFriend`**: Manages the lifecycle of a single music score using a Zustand-based state management system.
- **`MeiFriendWorkspace`**: Manages collections of scores and resources, providing a workspace-level slice system.
- **`mei/`**: Contains logic for handling the semantics of MEI scores.
- **`models/`**: Includes music logic models that are computationally useful and independent of the MEI format, facilitating general music processing.

### `@mei-friend/plugins`

This package contains standardized slices and services for common music encoding tasks:

- **`VerovioService`**: Integrates the Verovio engraving engine via a Web Worker for high-quality, non-blocking score rendering.
- **`MeiEditorSlice`**: Provides high-level actions for manipulating MEI content programmatically.
- **`FacsimileService`**: Adds support for managing and displaying image-based facsimile sources.
- **`AnnotationService`**: Facilitates the creation and management of musical annotations and editorial markup.

## Installation
To try out mei-friend, simply navigate to the production instance on [https://mei-friend.mdw.ac.at](https://mei-friend.mdw.ac.at/). 
To run your own instance locally on your system, please follow the [installation instructions](INSTALL.md). 

## Publications
Goebl, W., & Weigl, D. M. (2024). mei-friend: An Interactive Web-based Editor for Digital Music Encodings. <em>Journal of Open Source Software</em>, 9(97), 6002. doi:[10.21105/joss.06002](https://doi.org/10.21105/joss.06002)

Plaksin, A. (2023). Understanding the needs of music editors in a digital world. Adding support for editorial markup to the mei-friend editor. In Proc. International Conference on Digital Libraries for Musicology, Milan, Italy. doi: [10.1145/3625135.3625149](https://doi.org/10.1145/3625135.3625149).

Goebl, W., & Weigl, D. M. (2023). mei-friend v1.0: Music Encoding in the Browser. Encoding Cultures. Joint MEC and TEI Conference 2023, Paderborn, Germany. <https://teimec2023.uni-paderborn.de/contributions/159.html>.

Goebl, W. & Weigl, D. M. (2023). The mei-friend Web Application: Editing MEI in the Browser. Music Encoding Conference Proceedings 2022 [Late-breaking Reports]. 
doi:[10.17613/dnj6-yy29](https://dx.doi.org/10.17613/dnj6-yy29).

Goebl, W. & Weigl, D. M. (2022). Alleviating the Last Mile of Encoding: The mei-friend Package for the Atom Text Editor.  In S. Münnich & D. Rizo (Eds.), Music Encoding Conference Proceedings 2021 (pp. 31&ndash;39). University of Alicante. doi:[10.17613/fc1c-mx52](https://doi.org/10.17613/fc1c-mx52) (**Best Paper Award MEC'21**).

## Acknowledgements

The *mei-friend* Web application is developed by [Werner Goebl](https://iwk.mdw.ac.at/goebl) ([@wergo](https://github.com/wergo)) and [David M. Weigl](https://iwk.mdw.ac.at/david-weigl) ([@musicog](https://github.com/musicog)), [Department of Music Acoustics – Wiener Klangstil (IWK)](https://iwk.mdw.ac.at), [mdw – University of Music and Performing Arts Vienna](https://mdw.ac.at). Development is undertaken as part of the [Signature Sound Vienna Project](https://iwk.mdw.ac.at/signature-sound-vienna). This research was funded by the [Austrian Science Fund (FWF)](https://fwf.ac.at) P 34664-G. The *mei-friend* Atom plugin package was developed as part of [TROMPA](https://trompamusic.eu) (Towards Richer Online Music Public-domain Archives), with funding from the [European Union's Horizon 2020 research and innovation programme](https://ec.europa.eu/info/research-and-innovation/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-2020_en) H2020-EU.3.6.3.1. under grant agreement No 770376.  Additional support for annotations and editorial markup, implemented by [Anna Plaksin](https://kreativ.institute/en/ueber-kio/team/anna-plaksin), is funded by the Deutsche Forschungsgemeinschaft (DFG, German Research Foundation) under the National Research Data Infrastructure – [441958017](https://gepris.dfg.de/gepris/projekt/441958017).

## License

The *mei-friend* Web application is published under the [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html) license.
