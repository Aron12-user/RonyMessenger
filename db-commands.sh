#!/bin/bash

# Script pour gérer les commandes de base de données

case "$1" in
  "generate")
    npx drizzle-kit generate
    ;;
  "push")
    npx drizzle-kit push
    ;;
  "studio")
    npx drizzle-kit studio
    ;;
  *)
    echo "Usage: ./db-commands.sh [generate|push|studio]"
    ;;
esac