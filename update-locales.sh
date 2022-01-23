#!/bin/bash

# SPDX-License-Identifier: Apache-2.0

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

wget -O "$SCRIPT_DIR/../src/csl/locales/README.md" https://github.com/citation-style-language/locales/raw/master/README.md
wget -O "$SCRIPT_DIR/../src/csl/locales/locales.json" https://github.com/citation-style-language/locales/raw/master/locales.json
