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

if [ ! -f "./styles/README.md" ]; then
    git clone https://github.com/citation-style-language/styles.git styles
fi
if [ -d "./styles" ]; then
    cd styles
    git pull origin master
    ls *.csl |
    sed 's/\.[^.]*$//' | # remove extension
    sed 's/\(.*\)/"\1"/g' | # wrap each style in double quotes
    tr '\n' ',' | # replace line-breaks with commas
    sed 's/\(.\).$/\1];/g' | # replace last comma with: ];
    sed 's/^/var\ allStyles\ =\ [/g' > ../cite_styles.js # insert variable name and [ at start
else
    echo "Unable to clone styles repository."
fi

