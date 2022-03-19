`qrcodegen` is not available as an npm package. This local copy of `qrcodegen.ts` is from a
tagged release at https://github.com/nayuki/QR-Code-generator/tree/master/typescript-javascript.
The only modifications made to the source are:

1. Change each
   ```
   namespace ____ {}
   ```
   to
   ```
   export namespace ____ {}
   ```
   so that the classes can be imported into other modules.

