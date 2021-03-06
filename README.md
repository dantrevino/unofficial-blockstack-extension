# Unofficial Blockstack Extension

This is a web extension to add Blockstack support to the Web Browser by
making it so a user can log into the browser and authenticate apps via
popup windows instead of through https://browser.blockstack.org/ or
having to run their own instance of the Blockstack Browser. This makes
the experience much more native and easy to use!

Currently you can not edit your profile or manage your wallet. This is
more of a proof of concept then a finished product, and it may have bugs;
use it at your own risk!

![screenshot-1](/gfx/screenshot-1.png)

## Features

- Creating/Recovering Accounts
- Managing Multiple Identities
- App Authentication
- App lookup via [blockstack-browser's repo](https://blockstack-browser-server.appartisan.com/data)

## Downloads

- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/u-blockstack-extension/)
- [Chrome](https://chrome.google.com/webstore/detail/unofficial-blockstack-ext/ldkenndopbdlbphmdmnmanmkhcjahmnm)

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
