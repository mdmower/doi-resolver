#!/bin/sh

# Copyright (C) 2016 Matthew D. Mower
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

zip -r doi.zip . -x ".git*" ".jshintrc" "output_styles.sh" "styles/*" "locales/*" "citeproc-js/*" "*README.md" "*Readme.md" "*Readme.markdown" "zip_extension.sh" "doi.zip" "*LICENSE*"
