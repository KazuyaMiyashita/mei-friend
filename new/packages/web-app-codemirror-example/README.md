# MeiFriend CodeMirror Sync Example

This example demonstrates bidirectional synchronization between two CodeMirror 6 XML editors using the `@mei-friend/core` synchronization system and the `@mei-friend/plugin-codemirror` package.

Any changes made in one editor will be reflected in the other after a short debounce period, mediated by the shared `MeiFriend` instance.
