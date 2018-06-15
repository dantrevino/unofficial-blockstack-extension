# Unofficial Blockstack Extension

This is a web extension created to make it easier to log in to Blockstack Apps.

## Downloads

- Firefox:
- Chrome:

## Building

- `npm run build` will create a built extension in the `/build` directory.
- `npm run build:prod` will build production.

## Testing

```
npm run build
cd build
web-ext run
```

Where [web-ext](https://github.com/mozilla/web-ext) is the Mozilla web extension tester found on NPM.

## Known Issues

- No way to edit or update profile, register names, use wallet, etc
  - Main component is still WIP and in `/src_archive` for now.

## License

It's under [MPL-2.0](LICENSE.md), similar to the [Blockstack Browser](https://github.com/blockstack/blockstack-browser). It uses some [images](/src/assets/images/appIcons) and the [App List](src/common/app-list.ts), along with lots of translated logic from the Browser source.

Icons (`/src/assets/images/icon-16`, `icon-48`, `icon-128`, etc) are under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), as well as project-graphics (found in `/gfx`).

<sup><sub>*Soli Deo Gloria*</sub></sup>