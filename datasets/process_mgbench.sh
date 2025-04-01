#!/bin/bash
head -n 300000 "$1" | gzip -9 > "$2"
