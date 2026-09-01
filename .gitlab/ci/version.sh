#!/bin/sh
set -e
grep -m1 '"version"' "$1" | sed -E 's/.*"version": *"([^"]+)".*/\1/'
