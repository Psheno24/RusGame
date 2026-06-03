#!/usr/bin/env bash
# На сервере после push:  cd /opt/rusgame && bash update.sh
exec bash "$(cd "$(dirname "$0")" && pwd)/deploy/update.sh"
