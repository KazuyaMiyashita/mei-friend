# mei-friend

This is a Proof of Concept for my refactoring plan for [mei-friend/mei-friend](https://github.com/mei-friend/mei-friend).

---

**mei-friend** is an ecosystem for the Music Encoding Initiative (MEI), providing tools and applications for creating, editing, and analyzing digital music encodings. It consists of three primary components:

- [**`@mei-friend/core`**](./packages/core/README.md): A foundational library for programmatically handling MEI structures and managing score lifecycles.
- [**`@mei-friend/lib-verovio-react`**](./packages/lib-verovio-react/README.md): A React component library providing an interactive, overlay-enabled wrapper for Verovio.
- **`@mei-friend/lib-codemirror`**: A CodeMirror plugin integrates XML string editing with MeiFriend state management.
- **`@mei-friend/web-app`**: A full-featured web-based music notation editor that integrates the core and plugins into a cohesive user experience.

The web application serves as a **"last-mile" editor** for music encoding, specifically designed to streamline the cleanup of data generated through Optical Music Recognition (OMR) or conversion from other formats.

Originally developed as a plugin for the Atom text editor, **mei-friend** has been re-architected as a cross-browser web application and a modular toolkit, offering its functionalities as independent, reusable components.

The web application is available online at: **[https://mei-friend.miy2.com](https://mei-friend.miy2.com)**

## Web Application Features

- Two-way support for displaying and editing MEI scores using Verovio and a code editor.
- Basic functions for inputting and editing MEI scores.
- Managing multiple files with the workspace feature.
- Online collaborative editing of score.

Originally, it also included MEI schema validation, facsimile display, and annotation features. These will be added later.

## Toolkit Features

### `@mei-friend/core`

The core package provides the infrastructure for managing MEI data:

- **`MeiFriend`**: Manages the lifecycle of a single music score. It serves as the primary host for score-level plugins.
- **`MeiFriendWorkspace`**: Manages collections of scores and resources, providing a workspace-level plugin system.
- **`mei/`**: Contains logic for handling the semantics of MEI scores.
- **`models/`**: Includes music logic models that are computationally useful and independent of the MEI format, facilitating general music processing.

see [./packages/core/README.md](./packages/core/README.md) for more details.

## Installation
To try out mei-friend, simply navigate to the production instance on [https://mei-friend.miy2.com](https://mei-friend.miy2.com). 
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

The *mei-friend* Web application and liberaries are published under the [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html) license.
