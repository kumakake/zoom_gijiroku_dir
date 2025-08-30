#!/bin/bash
# 一時的な修正スクリプト
cd /app
sed -i 's/\t\t\t<\/div>$/\t\t\t\t<\/div>\n\t\t)}/' src/pages/TranscriptFormatPage.tsx