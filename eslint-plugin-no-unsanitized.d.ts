declare module 'eslint-plugin-no-unsanitized' {
  import type {Linter} from 'eslint';

  const plugin: {
    configs: {
      recommended: Linter.Config;
    };
  };

  export default plugin;
}
