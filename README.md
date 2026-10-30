# AstroEngine

A data-driven, extensible 3D game engine for the Web.

AstroEngine is designed around a small runtime core, JSON-described objects, component-based extensions, and renderer-independent game logic.

## Vision

- **Data-driven** — describe scenes and objects with JSON.
- **Extensible** — components, object types, and systems can be registered by plugins.
- **Renderer-independent** — the core runtime should not depend on Vue or Three.js.
- **Web-native** — TypeScript first, with a future Web 3D renderer and editor.

## Planned architecture

```text
AstroEngine
├── Core Runtime
│   ├── Object
│   ├── Component
│   ├── Scene
│   ├── Registry
│   └── Lifecycle
├── Serialization
│   ├── JSON
│   └── Schema
├── Renderer
│   └── Three.js / TresJS
└── Editor
    └── Vue
```

## Status

Early development. The first milestone is the object runtime and component registry.

## License

TBD
