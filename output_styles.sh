#!/bin/sh

# Copyright (C) 2013 Matthew D. Mower
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

if [ ! -d "styles" ]; then
    git clone https://github.com/citation-style-language/styles.git styles
    cd styles
else
    cd styles
    git pull origin master
fi
if [ -f "README.md" ]; then
    # remove existing styles
    head -n -1 ../cite_styles.js > ../tmp.js && mv ../tmp.js ../cite_styles.js
#              remove extension     wrap styles in quotes   \n --> ,      last comma --> ];        insert variable name and [       append styles
    ls *.csl | sed 's/\.[^.]*$//' | sed 's/\(.*\)/"\1"/g' | tr '\n' ',' | sed 's/\(.\).$/\1];/g' | sed 's/^/var\ allStyles\ =\ [/g' >> ../cite_styles.js
    cd ..
    echo "" >> cite_styles.js
    rm -rf styles
else
    echo "Styles repository unavailable"
fi
