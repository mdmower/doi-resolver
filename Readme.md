# DOI Resolver

A browser extension to resolve DOIs (digital object identifiers) to their web destinations. Available at:

- [Chrome Web Store](https://chrome.google.com/webstore/detail/doi-resolver/goanbaknlbojfglcepjnankoobfakbpg) for Google Chrome
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/doi-resolver/blinbkglegdjgkpblpbgiemkbmkflgah) for Microsoft Edge
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/doi-resolver/) for Firefox

## Features

- Resolve DOIs and ShortDOIs via:
  - Extension button
  - Selected text context menu
  - Address bar with keyword: doi  
    _Address bar usage:_ Type `doi` and press space. Now you can input a DOI and press enter to navigate to the web destination.
- Maintain a history of visited DOIs along with their automatically fetched titles
- Generate QR codes which can be scanned by smart phones to share a publication
- Generate formatted citations for publications
- Automatically convert DOIs on web pages into links
- Use your own DOI resolver URL &ndash; useful if your institution provides a proxy service

## Development

Clone git repository locally and then install npm packages

```
npm install
```

Available npm scripts:

- `npm run lint` - Lint source using eslint
- `npm run format` - Format source using prettier
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
