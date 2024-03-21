# DOI Resolver

Quickly resolve DOI (digital object identifier) codes to their web destinations. Available at:

- [Chrome Web Store](https://chrome.google.com/webstore/detail/doi-resolver/goanbaknlbojfglcepjnankoobfakbpg) for Google Chrome
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/doi-resolver/) for Firefox

## Features

1. Resolve DOI and ShortDOI codes via:
   - Extension button
   - Right-click on selected text (optional setting)
   - Address bar with keyword: doi
     _Address bar usage:_ Type `doi` and press the space key. Now you can input a DOI code and press enter to retrieve the web destination.
1. Generate QR codes which can be scanned by smart phones to share a publication
1. Automatically convert DOI codes on web pages into links (optional setting)
1. Specify your own DOI resolver URL &ndash; useful if your institution provides a proxy service
1. Generate formatted citations for publications
1. Retain history of entered DOI codes

## Build

Clone git repository locally and then install npm packages

```
npm install
```

Available npm scripts:

- `npm run lint` - Lint your changes using eslint
- `npm run format` - Use Prettier to format your changes
- `npm run build [chrome|edge|firefox]` - Build the extension; output to `dist/<browser>/`
- `npm run build-debug [chrome|edge|firefox]` - Build the extension without HTML/CSS minification and include source maps in transpiled JS; output to `dist/<browser>/`
- `npm run pkg [chrome|edge|firefox]` - Compress built extension from `dist/<browser>/` into a `.zip` file and output to `pkg/`
- `npm run clean` - Clear out the contents of `dist/`
- `npm run release` - Run lint, clean, build, and pkg scripts, in that order (builds for all browsers)

## Languages

Internationalization is supported and contributions are welcome. Reference English UI strings and descriptions in [messages.json](/static/_locales/en/messages.json). Create `static/_locales/xx/manifest.json` where `xx` is a supported locale code from [chrome.i18n: Locales](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales) and prepare a pull request. Thanks!

Languages supported: English

## License

Apache License, Version 2.0.

Copyright 2016 Matthew D. Mower (mdmower)
